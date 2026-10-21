import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, request, setUnauthorizedHandler } from './api'
import * as auth from './api/auth'
import * as chat from './api/chat'
import * as documents from './api/documents'
import * as privacy from './api/privacy'
import * as admin from './api/admin'
import * as ingestion from './api/ingestion'

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
}

describe('API transport', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    window.fetch = fetchMock
    globalThis.fetch = fetchMock
    setUnauthorizedHandler(null)
  })

  afterEach(() => {
    setUnauthorizedHandler(null)
    vi.restoreAllMocks()
  })

  it('uses same-origin credentials, JSON headers, and serializes bodies', async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }))
    await api.post('/sample', { value: 3 })
    expect(fetchMock).toHaveBeenCalledWith('/api/sample', {
      method: 'POST',
      body: '{"value":3}',
      headers: expect.any(Headers),
      credentials: 'same-origin',
    })
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('leaves multipart content type to the browser and supports requests without bodies', async () => {
    fetchMock.mockResolvedValue(response(204))
    const form = new FormData()
    form.append('file', new Blob(['doc']), 'doc.txt')
    await api.postForm('/upload', form)
    await api.post('/empty')
    expect(fetchMock.mock.calls[0][1]?.body).toBe(form)
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).has('Content-Type')).toBe(false)
    expect(fetchMock.mock.calls[1][1]?.body).toBeUndefined()
  })

  it('sends PATCH and DELETE requests through the shared transport', async () => {
    fetchMock.mockResolvedValue(response(204))
    await api.patch('/item', { label: 'updated' })
    await api.delete('/item')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: '{"label":"updated"}' })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' })
  })

  it('returns undefined for 204 and JSON for successful responses', async () => {
    fetchMock.mockResolvedValueOnce(response(204)).mockResolvedValueOnce(response(200, { id: 'x' }))
    await expect(request('/empty')).resolves.toBeUndefined()
    await expect(request('/item')).resolves.toEqual({ id: 'x' })
  })

  it('maps detail, error, and fallback messages while tolerating invalid error JSON', async () => {
    fetchMock
      .mockResolvedValueOnce(response(400, { detail: 'invalid input' }))
      .mockResolvedValueOnce(response(502, { error: 'upstream unavailable' }))
      .mockResolvedValueOnce(new Response('not json', { status: 503 }))
    await expect(request('/bad')).rejects.toMatchObject({ status: 400, message: 'invalid input' })
    await expect(request('/upstream')).rejects.toMatchObject({ status: 502, message: 'upstream unavailable' })
    await expect(request('/offline')).rejects.toMatchObject({ status: 503, message: 'Request failed (503)' })
    expect(new ApiError(418, 'teapot')).toBeInstanceOf(Error)
  })

  it('notifies unauthorized handler for 401 responses', async () => {
    const unauthorized = vi.fn()
    setUnauthorizedHandler(unauthorized)
    fetchMock.mockResolvedValue(response(401, { detail: 'expired' }))
    await expect(api.get('/private')).rejects.toBeInstanceOf(ApiError)
    expect(unauthorized).toHaveBeenCalledOnce()
    setUnauthorizedHandler(null)
    fetchMock.mockResolvedValue(response(401, { detail: 'expired' }))
    await expect(api.get('/private')).rejects.toBeInstanceOf(ApiError)
  })

  it('parses streamed chat events across arbitrary response chunk boundaries', async () => {
    const completed = {
      id: 'message-1',
      question: 'question',
      answer: 'first answer',
      status: 'ok',
      sources: [],
      model: { name: 'Local', provider: 'openai', model: 'configured-model' },
      latency_ms: 14,
      redacted: false,
      created_at: '2026-01-01T00:00:00Z',
    }
    const bytes = new TextEncoder().encode(
      `event: chunk\ndata: {"text":"first "}\n\nevent: chunk\ndata: {"text":"answer"}\n\nevent: done\ndata: ${JSON.stringify(completed)}\n\n`,
    )
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 13))
        controller.enqueue(bytes.slice(13, 57))
        controller.enqueue(bytes.slice(57))
        controller.close()
      },
    })
    fetchMock.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    const onChunk = vi.fn()

    await expect(chat.sendMessage('session-1', 'question', onChunk)).resolves.toEqual(completed)
    expect(onChunk.mock.calls).toEqual([['first '], ['first answer']])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/sessions/session-1/messages',
      expect.objectContaining({
        method: 'POST',
        body: '{"question":"question"}',
        credentials: 'same-origin',
      }),
    )
  })

  it('logs safe structured metadata for completed JSON chat requests', async () => {
    const sensitive = [
      'question-secret',
      'answer-secret',
      'prompt-secret',
      'credential-secret',
      'token-secret',
      'api-key-secret',
      'session-token-secret',
    ]
    const completed = {
      id: 'message-1',
      question: sensitive[0],
      answer: sensitive[1],
      status: 'ok',
      sources: [],
      model: { name: sensitive.slice(2).join(' '), provider: 'openai', model: 'local-model:14b' },
      latency_ms: 14,
      redacted: false,
      created_at: '2026-01-01T00:00:00Z',
    }
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(completed), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-123' },
      }),
    )

    await chat.sendMessage('session-1', sensitive[0])

    const records = info.mock.calls.map(([record]) => record as Record<string, unknown>)
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ event: 'chat.sendMessage', lifecycle: 'start', status: 'start' })
    expect(records[1]).toMatchObject({
      event: 'chat.sendMessage',
      lifecycle: 'complete',
      status: 200,
      request_id: 'request-123',
      provider: 'openai',
      model: 'local-model:14b',
    })
    expect(records[1].duration_ms).toEqual(expect.any(Number))
    const serialized = JSON.stringify([...info.mock.calls, ...vi.mocked(console.warn).mock.calls])
    for (const value of sensitive) expect(serialized).not.toContain(value)
  })

  it('omits credential-shaped provider and model labels from chat diagnostics', async () => {
    const credentialProvider = 'sk-provider-secret-123456'
    const credentialModel = 'sk_live_test_secret_123456'
    const completed = {
      id: 'message-credential-labels',
      question: 'question',
      answer: 'answer',
      status: 'ok',
      sources: [],
      model: { name: 'Local', provider: credentialProvider, model: credentialModel },
      latency_ms: 14,
      redacted: false,
      created_at: '2026-01-01T00:00:00Z',
    }
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(completed), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-credential-labels' },
      }),
    )

    await chat.sendMessage('session-1', 'question')

    const records = info.mock.calls.map(([record]) => record as Record<string, unknown>)
    expect(records[0]).toMatchObject({ lifecycle: 'start', status: 'start' })
    expect(records[1]).toMatchObject({
      lifecycle: 'complete',
      status: 200,
      request_id: 'request-credential-labels',
      duration_ms: expect.any(Number),
      provider: undefined,
      model: undefined,
    })
    const serialized = JSON.stringify([...info.mock.calls, ...warn.mock.calls])
    expect(serialized).not.toContain(credentialProvider)
    expect(serialized).not.toContain(credentialModel)

    const ollamaCompleted = {
      ...completed,
      id: 'message-ollama-label',
      model: { name: 'DeepSeek R1', provider: 'openai', model: 'deepseek-r1:14b' },
    }
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(ollamaCompleted), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-ollama-label' },
      }),
    )
    await chat.sendMessage('session-1', 'question')

    const updatedRecords = info.mock.calls.map(([record]) => record as Record<string, unknown>)
    expect(updatedRecords[3]).toMatchObject({
      lifecycle: 'complete',
      status: 200,
      request_id: 'request-ollama-label',
      duration_ms: expect.any(Number),
      provider: 'openai',
      model: 'deepseek-r1:14b',
    })
  })

  it('logs streamed completion metadata without streamed or returned content', async () => {
    const sensitive = [
      'stream-question-secret',
      'stream-answer-secret',
      'stream-prompt-secret',
      'stream-credential-secret',
      'stream-api-key-secret',
      'stream-session-token-secret',
    ]
    const completed = {
      id: 'message-2',
      question: sensitive[0],
      answer: sensitive[1],
      status: 'ok',
      sources: [],
      model: { name: sensitive.slice(2).join(' '), provider: 'openai', model: 'ollama:deepseek-r1' },
      latency_ms: 14,
      redacted: false,
      created_at: '2026-01-01T00:00:00Z',
    }
    const bytes = new TextEncoder().encode(
      `event: chunk\ndata: ${JSON.stringify({ text: sensitive[1] })}\n\nevent: done\ndata: ${JSON.stringify(completed)}\n\n`,
    )
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'X-Request-ID': 'stream-request-9' },
      }),
    )

    await chat.sendMessage('session-1', sensitive[0])

    const records = info.mock.calls.map(([record]) => record as Record<string, unknown>)
    expect(records[1]).toMatchObject({
      lifecycle: 'complete',
      status: 200,
      request_id: 'stream-request-9',
      provider: 'openai',
      model: 'ollama:deepseek-r1',
    })
    const serialized = JSON.stringify(info.mock.calls)
    for (const value of sensitive) expect(serialized).not.toContain(value)
  })

  it('logs only safe failure class and status when the response body contains sensitive text', async () => {
    const sensitive = [
      'failure-question-secret',
      'failure-body-secret',
      'failure-prompt-secret',
      'failure-credential-secret',
      'failure-api-key-secret',
      'failure-session-token-secret',
    ]
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: sensitive.slice(1).join('|') }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'failure-request-5' },
      }),
    )

    await expect(chat.sendMessage('session-1', sensitive[0])).rejects.toMatchObject({ status: 503 })

    expect(info).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toMatchObject({
      event: 'chat.sendMessage',
      lifecycle: 'failure',
      status: 503,
      request_id: 'failure-request-5',
      error_class: 'ApiError',
    })
    const serialized = JSON.stringify([...info.mock.calls, ...warn.mock.calls])
    for (const value of sensitive) expect(serialized).not.toContain(value)
  })

  it('logs cancelled streamed requests without cancellation details or streamed text', async () => {
    const sensitive = ['cancel-question-secret', 'cancel-response-secret', 'cancel-token-secret']
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`event: chunk\ndata: {"text":"${sensitive[1]}"}\n\n`))
        const abortError = new Error(sensitive[2])
        abortError.name = 'AbortError'
        controller.error(abortError)
      },
    })
    fetchMock.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'X-Request-ID': 'cancel-request-2' },
      }),
    )

    await expect(chat.sendMessage('session-1', sensitive[0])).rejects.toThrow(
      'The configured model could not answer this request.',
    )

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toMatchObject({
      lifecycle: 'cancelled',
      status: 200,
      request_id: 'cancel-request-2',
      error_class: 'Error',
    })
    const serialized = JSON.stringify([...info.mock.calls, ...warn.mock.calls])
    for (const value of sensitive) expect(serialized).not.toContain(value)
  })

  it('hides provider error details from streamed chat callers', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'event: error\ndata: {"message":"The configured model could not answer this request. Please try again or open a support ticket."}\n\n',
          ),
        )
        controller.close()
      },
    })
    fetchMock.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    await expect(chat.sendMessage('session-1', 'question')).rejects.toThrow(
      'The configured model could not answer this request. Please try again or open a support ticket.',
    )
  })
})

describe('endpoint contracts', () => {
  let get: ReturnType<typeof vi.spyOn<typeof api, 'get'>>
  let post: ReturnType<typeof vi.spyOn<typeof api, 'post'>>
  let postForm: ReturnType<typeof vi.spyOn<typeof api, 'postForm'>>
  let patch: ReturnType<typeof vi.spyOn<typeof api, 'patch'>>
  let del: ReturnType<typeof vi.spyOn<typeof api, 'delete'>>

  beforeEach(() => {
    get = vi.spyOn(api, 'get').mockResolvedValue([])
    post = vi.spyOn(api, 'post').mockResolvedValue({})
    postForm = vi.spyOn(api, 'postForm').mockResolvedValue({})
    patch = vi.spyOn(api, 'patch').mockResolvedValue({})
    del = vi.spyOn(api, 'delete').mockResolvedValue({})
  })

  it('covers account and chat endpoint wrappers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(200, { id: 'message-1' }))
    vi.stubGlobal('fetch', fetchMock)
    window.fetch = fetchMock
    auth.getCurrentUser()
    auth.getPlanOptions()
    auth.signIn('ava', 'secret')
    auth.register('ava', 'secret', 'premium')
    auth.signOut()
    chat.listSessions()
    chat.getSession('s/1')
    chat.createSession()
    chat.deleteSession('s/1')
    await chat.sendMessage('s/1', 'question')
    chat.submitFeedback('s/1', 'm/1', 'down', ['unclear'], 'comment')
    expect(get).toHaveBeenNthCalledWith(1, '/auth/me')
    expect(post).toHaveBeenCalledWith('/auth/register', {
      username: 'ava',
      password: 'secret',
      plan: 'premium',
      policy_accepted: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/sessions/s/1/messages',
      expect.objectContaining({
        method: 'POST',
        body: '{"question":"question"}',
        credentials: 'same-origin',
      }),
    )
    expect(del).toHaveBeenCalledWith('/chat/sessions/s/1')
  })

  it('encodes document, audit, and feedback filters', () => {
    documents.listDocuments({ query: '  reset password ', category: 'Identity & Access', tag: 'account lock' })
    documents.listDocuments({ query: ' ', category: 'All categories', tag: '' })
    documents.getDocument('vpn')
    admin.listFeedback('down')
    admin.listFeedback('')
    admin.listAudit({ event: ' auth.login ', outcome: 'failure', username: 'ava smith' })
    admin.listAudit({ event: ' ', outcome: '', username: '' })
    expect(get).toHaveBeenCalledWith('/documents?category=Identity+%26+Access&tag=account+lock&q=reset+password')
    expect(get).toHaveBeenCalledWith('/documents?')
    expect(get).toHaveBeenCalledWith('/admin/audit?event=+auth.login+&outcome=failure&username=ava+smith')
  })

  it('covers privacy, admin, and ingestion endpoint methods', () => {
    privacy.getPolicy()
    privacy.acceptPolicy()
    privacy.exportUserData()
    privacy.eraseUserData()
    privacy.deleteUserAccount('secret')
    admin.listConnections()
    admin.listUsers()
    admin.getFeedbackStats()
    admin.saveConnection(null, {} as never)
    admin.saveConnection('c1', {} as never)
    admin.testConnection('c1')
    admin.deleteConnection('c1')
    admin.updateUser('u1', { role: 'admin' })
    const form = new FormData()
    ingestion.getIngestionOptions()
    ingestion.listPipelines()
    ingestion.createPipeline(form)
    ingestion.getPipeline('p1')
    ingestion.getPipelineChunks('p1')
    expect(post).toHaveBeenCalledWith('/privacy/account/delete', { password: 'secret' })
    expect(patch).toHaveBeenCalledWith('/admin/connections/c1', {})
    expect(postForm).toHaveBeenCalledWith('/admin/ingestion/pipelines', form)
  })
})
