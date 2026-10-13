import { api, requestResponse } from '../api'
import type { ChatSession, Message, Rating } from '../types/chat'

export const listSessions = () => api.get<ChatSession[]>('/chat/sessions')
export const getSession = (sessionId: string) => api.get<ChatSession>(`/chat/sessions/${sessionId}`)
export const createSession = () => api.post<ChatSession>('/chat/sessions')
export const deleteSession = (sessionId: string) => api.delete(`/chat/sessions/${sessionId}`)
const streamError = 'The configured model could not answer this request. Please try again or open a support ticket.'
const safeMetadataPattern = /^[A-Za-z0-9._:-]{1,128}$/
const safeProviders = new Set(['mock', 'openai', 'azure_openai', 'anthropic'])
const credentialLikeModelPattern = /(?:^|[^a-z0-9])(?:sk|pk|rk)[_-][a-z0-9_-]{8,}|(?:^|[^a-z0-9])(?:api[_-]?key|bearer|token)[_-][a-z0-9_-]{8,}/i

function safeMetadata(value: unknown): string | undefined {
  return typeof value === 'string' && safeMetadataPattern.test(value) ? value : undefined
}

function safeProvider(value: unknown): string | undefined {
  return typeof value === 'string' && safeProviders.has(value) ? value : undefined
}

function safeModel(value: unknown): string | undefined {
  return typeof value === 'string' && safeMetadataPattern.test(value) && !credentialLikeModelPattern.test(value)
    ? value
    : undefined
}

function logSendMessage(
  lifecycle: 'start' | 'complete' | 'failure' | 'cancelled',
  startedAt: number,
  values: { requestId?: string; status?: number; provider?: unknown; model?: unknown; errorClass?: unknown },
) {
  const fields = {
    event: 'chat.sendMessage',
    lifecycle,
    request_id: values.requestId,
    status: values.status ?? lifecycle,
    duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
    provider: safeProvider(values.provider),
    model: safeModel(values.model),
    error_class: safeMetadata(values.errorClass),
  }
  if (lifecycle === 'failure' || lifecycle === 'cancelled') console.warn(fields)
  else console.info(fields)
}

function errorMetadata(reason: unknown): { errorClass?: string; requestId?: string; status?: number } {
  if (!(reason instanceof Error)) return {}
  const status = 'status' in reason && typeof reason.status === 'number' ? reason.status : undefined
  const requestId = 'requestId' in reason ? safeMetadata(reason.requestId) : undefined
  return { errorClass: safeMetadata(reason.constructor.name) ?? safeMetadata(reason.name), requestId, status }
}

function isAbortError(reason: unknown): boolean {
  return typeof reason === 'object' && reason !== null && 'name' in reason && reason.name === 'AbortError'
}

export async function sendMessage(
  sessionId: string,
  question: string,
  onChunk?: (answer: string) => void,
): Promise<Message> {
  const startedAt = performance.now()
  logSendMessage('start', startedAt, {})
  let requestId: string | undefined
  let status: number | undefined
  let errorClass: string | undefined
  let cancelled = false
  try {
    const response = await requestResponse(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    })
    status = response.status
    requestId = safeMetadata(response.headers.get('X-Request-ID'))
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      const message = await response.json() as Message
      logSendMessage('complete', startedAt, {
        requestId, status, provider: message.model?.provider, model: message.model?.model,
      })
      return message
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error(streamError)

    const decoder = new TextDecoder()
    let buffer = ''
    let event = 'message'
    let data: string[] = []
    let answer = ''
    let completed: Message | null = null
    const dispatch = () => {
      if (!data.length) return
      let payload: { text?: unknown } | Message
      try {
        payload = JSON.parse(data.join('\n')) as { text?: unknown } | Message
      } catch {
        throw new Error(streamError)
      }
      if (event === 'chunk') {
        if (typeof (payload as { text?: unknown }).text !== 'string') throw new Error(streamError)
        answer += (payload as { text: string }).text
        onChunk?.(answer)
      } else if (event === 'done') {
        completed = payload as Message
      } else if (event === 'error') {
        throw new Error(streamError)
      }
      event = 'message'
      data = []
    }
    const readLine = (line: string) => {
      if (!line) {
        dispatch()
      } else if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''))
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        let newline = buffer.indexOf('\n')
        while (newline >= 0) {
          readLine(buffer.slice(0, newline).replace(/\r$/, ''))
          buffer = buffer.slice(newline + 1)
          newline = buffer.indexOf('\n')
        }
        if (done) break
      }
      if (buffer) readLine(buffer.replace(/\r$/, ''))
      dispatch()
    } catch (reason) {
      const metadata = errorMetadata(reason)
      errorClass = metadata.errorClass
      cancelled = isAbortError(reason)
      await reader.cancel().catch(() => undefined)
      if (reason instanceof Error && reason.message === streamError) throw reason
      throw new Error(streamError)
    } finally {
      reader.releaseLock()
    }
    const result = completed as Message | null
    if (!result) throw new Error(streamError)
    logSendMessage('complete', startedAt, {
      requestId, status, provider: result.model?.provider, model: result.model?.model,
    })
    return result
  } catch (reason) {
    const metadata = errorMetadata(reason)
    errorClass ??= metadata.errorClass
    requestId ??= metadata.requestId
    status ??= metadata.status
    cancelled ||= isAbortError(reason)
    logSendMessage(cancelled ? 'cancelled' : 'failure', startedAt, { requestId, status, errorClass })
    throw reason
  }
}

export const submitFeedback = (
  sessionId: string,
  messageId: string,
  rating: Rating,
  categories: string[],
  comment: string,
) => api.post('/feedback', { session_id: sessionId, message_id: messageId, rating, categories, comment })
