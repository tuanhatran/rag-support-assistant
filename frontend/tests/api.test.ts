import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, request, setUnauthorizedHandler } from '../src/api'
import * as auth from '../src/api/auth'
import * as chat from '../src/api/chat'
import * as documents from '../src/api/documents'
import * as privacy from '../src/api/privacy'
import * as admin from '../src/api/admin'
import * as ingestion from '../src/api/ingestion'

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

  afterEach(() => setUnauthorizedHandler(null))

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

  it('covers account and chat endpoint wrappers', () => {
    auth.getCurrentUser()
    auth.getPlanOptions()
    auth.signIn('ava', 'secret')
    auth.register('ava', 'secret', 'premium')
    auth.signOut()
    chat.listSessions()
    chat.getSession('s/1')
    chat.createSession()
    chat.deleteSession('s/1')
    chat.sendMessage('s/1', 'question')
    chat.submitFeedback('s/1', 'm/1', 'down', ['unclear'], 'comment')
    expect(get).toHaveBeenNthCalledWith(1, '/auth/me')
    expect(post).toHaveBeenCalledWith('/auth/register', {
      username: 'ava',
      password: 'secret',
      plan: 'premium',
      policy_accepted: true,
    })
    expect(post).toHaveBeenCalledWith('/chat/sessions/s/1/messages', { question: 'question' })
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
