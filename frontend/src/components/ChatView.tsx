import { useEffect, useRef, useState } from 'react'
import * as chatApi from '../api/chat'
import { getDocument } from '../api/documents'
import { getPolicy } from '../api/privacy'
import type { ChatSession, Message, Rating, Source } from '../types/chat'
import type { DocumentItem } from '../types/documents'
import { ConversationRail } from './chat/ConversationRail'
import { ChatTranscript } from './chat/ChatTranscript'
import { FeedbackDialog } from './chat/FeedbackDialog'
import { MessageComposer } from './chat/MessageComposer'
import { SourceDialog } from './chat/SourceDialog'
import { PolicyModal } from './PolicyModal'

export function ChatView({ onBrowseDocuments }: { onBrowseDocuments: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [active, setActive] = useState<ChatSession | null>(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<DocumentItem | null>(null)
  const [feedback, setFeedback] = useState<Message | null>(null)
  const [notice, setNotice] = useState('')
  const [policyOpen, setPolicyOpen] = useState(false)
  const [retention, setRetention] = useState({ conversations: 90, feedback: 90 })
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function refreshSessions(preferred?: string) {
    const rows = await chatApi.listSessions()
    setSessions(rows)
    const target = rows.find((row) => row.id === preferred) ?? rows[0]
    if (target) await openSession(target.id)
    else setActive(null)
  }

  async function openSession(id: string) {
    const session = await chatApi.getSession(id)
    setActive(session)
  }

  useEffect(() => {
    refreshSessions()
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
    getPolicy()
      .then((policy) => setRetention(policy.retention))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [active?.messages?.length, sending])

  async function newConversation() {
    setError('')
    try {
      const created = await chatApi.createSession()
      setActive({ ...created, messages: [] })
      setSessions((current) => [created, ...current])
      inputRef.current?.focus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start a conversation.')
    }
  }

  async function removeSession(id: string) {
    if (!window.confirm('Delete this conversation and its feedback?')) return
    try {
      await chatApi.deleteSession(id)
      if (active?.id === id) setActive(null)
      await refreshSessions()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete conversation.')
    }
  }

  async function send(raw = question) {
    const value = raw.trim()
    if (!value || sending) return
    setQuestion('')
    setError('')
    setSending(true)
    try {
      let session = active
      if (!session) {
        session = await chatApi.createSession()
        session = { ...session, messages: [] }
        setActive(session)
      }
      const message = await chatApi.sendMessage(session.id, value)
      const updated = {
        ...session,
        title: session.messages?.length ? session.title : value.slice(0, 60),
        messages: [...(session.messages ?? []), message],
      }
      setActive(updated)
      setSessions((current) => [updated, ...current.filter((item) => item.id !== session!.id)])
      inputRef.current?.focus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The answer could not be generated.')
      setQuestion(value)
    } finally {
      setSending(false)
    }
  }

  async function openSource(item: Source) {
    try {
      setSource(await getDocument(item.document_id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document could not be opened.')
    }
  }

  async function rate(message: Message, rating: Rating) {
    if (!active) return
    if (rating === 'down') {
      setFeedback(message)
      return
    }
    try {
      await chatApi.submitFeedback(active.id, message.id, rating, [], '')
      setNotice('Thanks for rating this answer.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Feedback could not be saved.')
    }
  }

  async function submitFeedback(categories: string[], comment: string) {
    if (!active || !feedback) return
    try {
      await chatApi.submitFeedback(active.id, feedback.id, 'down', categories, comment)
      setFeedback(null)
      setNotice('Thanks. Your feedback has been recorded.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Feedback could not be saved.')
    }
  }

  return (
    <div className="chat-layout">
      <ConversationRail
        sessions={sessions}
        activeSessionId={active?.id}
        loading={loading}
        onCreate={newConversation}
        onSelect={openSession}
        onDelete={removeSession}
        onBrowseDocuments={onBrowseDocuments}
      />

      <section className="chat-panel">
        <div className="chat-toolbar">
          <div>
            <span className="eyebrow">IT SUPPORT / ASSISTANT</span>
            <h1>{active?.title && active.title !== 'New conversation' ? active.title : 'How can we help?'}</h1>
          </div>
          <span className="online-label">
            <span className="status-dot" />
            READY
          </span>
        </div>
        <ChatTranscript
          active={active}
          sending={sending}
          endRef={endRef}
          onSendSuggestion={(question) => void send(question)}
          onBrowseDocuments={onBrowseDocuments}
          onOpenSource={openSource}
          onRate={(message, rating) => void rate(message, rating)}
        />
        <MessageComposer
          question={question}
          sending={sending}
          error={error}
          notice={notice}
          retentionDays={retention.conversations}
          inputRef={inputRef}
          onQuestionChange={setQuestion}
          onSend={() => void send()}
          onDismissError={() => setError('')}
          onDismissNotice={() => setNotice('')}
          onOpenPolicy={() => setPolicyOpen(true)}
        />
      </section>

      {source && <SourceDialog source={source} onClose={() => setSource(null)} />}
      {feedback && (
        <FeedbackDialog
          retentionDays={retention.feedback}
          onClose={() => setFeedback(null)}
          onOpenPolicy={() => {
            setFeedback(null)
            setPolicyOpen(true)
          }}
          onSubmit={(categories, comment) => void submitFeedback(categories, comment)}
        />
      )}
      {policyOpen && <PolicyModal onClose={() => setPolicyOpen(false)} />}
    </div>
  )
}
