import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown, FileText, MessageSquarePlus, Plus, Send, Shield, Sparkles, Star, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react'
import { api } from '../api'
import type { ChatSession, DocumentItem, Message, Rating, Source } from '../types'
import { Markdown } from './Markdown'
import { PolicyModal } from './PolicyModal'

const suggestions = [
  'My VPN is stuck on Connecting, what should I do?',
  'My account keeps getting locked',
  'A pod is in CrashLoopBackOff with exit code 137',
  'The API gateway returns 403 Forbidden',
  'No space left on device on a Linux server',
]

const feedbackOptions = [
  ['incorrect', 'Incorrect'], ['incomplete', 'Incomplete'], ['irrelevant_sources', 'Sources missed the mark'],
  ['unclear', 'Hard to follow'], ['too_slow', 'Too slow'], ['other', 'Other'],
]

export function ChatView({ onBrowseDocuments }: { onBrowseDocuments: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [active, setActive] = useState<ChatSession | null>(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<DocumentItem | null>(null)
  const [feedback, setFeedback] = useState<Message | null>(null)
  const [feedbackCategories, setFeedbackCategories] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState('')
  const [policyOpen, setPolicyOpen] = useState(false)
  const [retention, setRetention] = useState({ conversations: 90, feedback: 90 })
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function refreshSessions(preferred?: string) {
    const rows = await api.get<ChatSession[]>('/chat/sessions')
    setSessions(rows)
    const target = rows.find(row => row.id === preferred) ?? rows[0]
    if (target) await openSession(target.id)
    else setActive(null)
  }

  async function openSession(id: string) {
    const session = await api.get<ChatSession>(`/chat/sessions/${id}`)
    setActive(session)
  }

  useEffect(() => {
    refreshSessions().catch(reason => setError(reason.message)).finally(() => setLoading(false))
    api.get<{ retention: { conversations: number; feedback: number } }>('/privacy/policy')
      .then(policy => setRetention(policy.retention)).catch(() => undefined)
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [active?.messages?.length, sending])

  async function newConversation() {
    setError('')
    try {
      const created = await api.post<ChatSession>('/chat/sessions')
      setActive({ ...created, messages: [] })
      setSessions(current => [created, ...current])
      inputRef.current?.focus()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start a conversation.') }
  }

  async function removeSession(id: string) {
    if (!window.confirm('Delete this conversation and its feedback?')) return
    try {
      await api.delete(`/chat/sessions/${id}`)
      if (active?.id === id) setActive(null)
      await refreshSessions()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete conversation.') }
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
        session = await api.post<ChatSession>('/chat/sessions')
        session = { ...session, messages: [] }
        setActive(session)
      }
      const message = await api.post<Message>(`/chat/sessions/${session.id}/messages`, { question: value })
      const updated = { ...session, title: session.messages?.length ? session.title : value.slice(0, 60), messages: [...(session.messages ?? []), message] }
      setActive(updated)
      setSessions(current => [updated, ...current.filter(item => item.id !== session!.id)])
      inputRef.current?.focus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The answer could not be generated.')
      setQuestion(value)
    } finally { setSending(false) }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() }
  }

  async function openSource(item: Source) {
    try { setSource(await api.get<DocumentItem>(`/documents/${item.document_id}`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Document could not be opened.') }
  }

  async function rate(message: Message, rating: Rating) {
    if (!active) return
    if (rating === 'down') { setFeedback(message); setFeedbackCategories([]); setComment(''); return }
    try {
      await api.post('/feedback', { session_id: active.id, message_id: message.id, rating, categories: [], comment: '' })
      setNotice('Thanks for rating this answer.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Feedback could not be saved.') }
  }

  async function submitFeedback(event: FormEvent) {
    event.preventDefault()
    if (!active || !feedback) return
    try {
      await api.post('/feedback', { session_id: active.id, message_id: feedback.id, rating: 'down', categories: feedbackCategories, comment })
      setFeedback(null)
      setNotice('Thanks. Your feedback has been recorded.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Feedback could not be saved.') }
  }

  return <div className="chat-layout">
    <aside className="conversation-rail">
      <div className="rail-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Conversations</h2></div><button className="icon-button icon-accent" aria-label="New conversation" title="New conversation" onClick={newConversation}><MessageSquarePlus size={18} /></button></div>
      <button className="button new-thread" onClick={newConversation}><Plus size={16} />New conversation</button>
      <div className="thread-list" aria-label="Conversation history">
        {loading && <div className="rail-empty">Loading history...</div>}
        {!loading && sessions.length === 0 && <div className="rail-empty">Your recent conversations will appear here.</div>}
        {sessions.map(item => <div className={`thread-row ${active?.id === item.id ? 'current' : ''}`} key={item.id}>
          <button className="thread-select" onClick={() => openSession(item.id)}><span>{item.title || 'New conversation'}</span><small>{new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></button>
          <button className="icon-button thread-delete" title="Delete conversation" aria-label={`Delete ${item.title}`} onClick={() => removeSession(item.id)}><Trash2 size={14} /></button>
        </div>)}
      </div>
      <div className="rail-bottom"><div className="knowledge-note"><BookOpen size={17} /><span><b>Grounded in runbooks</b><small>Answers link back to their source.</small></span></div><button className="text-button" onClick={onBrowseDocuments}>Browse knowledge base <ChevronDown size={14} className="rotate-icon" /></button></div>
    </aside>

    <section className="chat-panel">
      <div className="chat-toolbar"><div><span className="eyebrow">IT SUPPORT / ASSISTANT</span><h1>{active?.title && active.title !== 'New conversation' ? active.title : 'How can we help?'}</h1></div><span className="online-label"><span className="status-dot" />READY</span></div>
      <div className="message-scroll">
        {(!active || !active.messages?.length) && <div className="welcome-state"><div className="welcome-icon"><Sparkles size={22} /></div><h2>Start with a question.</h2><p>Find the next practical step in your internal IT runbooks.</p><div className="suggestion-grid">{suggestions.map((item, index) => <button key={item} className="suggestion" onClick={() => void send(item)}><span>0{index + 1}</span>{item}<ArrowHint /></button>)}</div><button className="browse-quiet" onClick={onBrowseDocuments}><FileText size={15} />Explore all support documents</button></div>}
        {active?.messages?.map((message, index) => <article className="exchange" key={message.id}>
          <div className="question-line"><span className="avatar user-avatar">Y</span><div className="question-bubble">{message.question}</div></div>
          <div className="answer-line"><span className="assistant-mark"><BookOpen size={15} /></span><div className="answer-content">
            <div className="answer-meta"><span>FIELDNOTE</span><span className="meta-dot">/</span><span>{message.model.model}</span><span className="meta-dot">/</span><span>{message.latency_ms} ms</span></div>
            {message.redacted && <div className="redaction-flag"><Shield size={13} />Sensitive data was redacted before processing</div>}
            {message.status === 'error' && <div className="error-banner">The configured model could not complete this answer.</div>}
            <Markdown>{message.answer}</Markdown>
            {!!message.sources.length && <div className="source-list"><span className="source-label">SOURCES</span>{message.sources.map((item, sourceIndex) => <button className="source-chip" key={`${item.document_id}-${item.section}`} onClick={() => openSource(item)}><span>[{sourceIndex + 1}]</span>{item.document_title}<b>&gt;</b>{item.section}</button>)}</div>}
            <div className="answer-actions"><span>Was this useful?</span><button className="rating-button" title="Helpful" onClick={() => rate(message, 'up')}><ThumbsUp size={14} /><span>Helpful</span></button><button className="rating-button" title="Not helpful" onClick={() => rate(message, 'down')}><ThumbsDown size={14} /><span>Not helpful</span></button><span className="answer-count">{String(index + 1).padStart(2, '0')}</span></div>
          </div></div>
        </article>)}
        {sending && <div className="thinking"><span className="assistant-mark"><Sparkles size={15} /></span><span>Searching runbooks and preparing an answer</span><span className="thinking-dots"><i /><i /><i /></span></div>}
        <div ref={endRef} />
      </div>
      <div className="composer-wrap">
        {error && <div className="inline-error" role="alert">{error}<button className="icon-button" aria-label="Dismiss" onClick={() => setError('')}><X size={14} /></button></div>}
        {notice && <div className="inline-success">{notice}<button className="icon-button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button></div>}
        <form className="composer" onSubmit={event => { event.preventDefault(); void send() }}><textarea ref={inputRef} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={keyDown} placeholder="Describe what you are trying to fix..." rows={2} maxLength={10000} aria-label="Your question" /><button className="send-button" disabled={!question.trim() || sending} aria-label="Send question" title="Send question"><Send size={17} /></button></form>
        <div className="composer-foot"><span><Shield size={12} />Questions are redacted and retained for {retention.conversations} days.</span><button className="text-link" onClick={() => setPolicyOpen(true)}>Data policy</button><span><kbd>Enter</kbd> to send <i /> <kbd>Shift + Enter</kbd> for a new line</span></div>
      </div>
    </section>

    {source && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSource(null) }}><section className="modal source-modal" role="dialog" aria-modal="true" aria-label={source.title}><div className="modal-head"><div><span className="eyebrow">{source.category} / KNOWLEDGE BASE</span><h2>{source.title}</h2></div><button className="icon-button" aria-label="Close document" onClick={() => setSource(null)}><X size={18} /></button></div><div className="document-modal-body"><Markdown>{source.markdown ?? ''}</Markdown></div></section></div>}
    {feedback && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFeedback(null) }}><form className="modal feedback-modal" onSubmit={submitFeedback} role="dialog" aria-modal="true" aria-labelledby="feedback-title"><div className="modal-head"><div><span className="eyebrow">ANSWER FEEDBACK</span><h2 id="feedback-title">What could be better?</h2></div><button type="button" className="icon-button" aria-label="Close feedback" onClick={() => setFeedback(null)}><X size={18} /></button></div><div className="feedback-options">{feedbackOptions.map(([value, label]) => <label className="check-row" key={value}><input type="checkbox" checked={feedbackCategories.includes(value)} onChange={event => setFeedbackCategories(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} /><span>{label}</span></label>)}</div><label className="field-label">Additional context<textarea className="text-area" value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} placeholder="Share a detail that would help improve this answer..." rows={4} /></label><p className="data-notice"><Shield size={13} />Comments are redacted and retained for {retention.feedback} days. <button type="button" className="text-link" onClick={() => { setFeedback(null); setPolicyOpen(true) }}>Data policy</button></p><div className="modal-actions"><button type="button" className="button" onClick={() => setFeedback(null)}>Cancel</button><button className="button button-primary"><Star size={15} />Submit feedback</button></div></form></div>}
    {policyOpen && <PolicyModal onClose={() => setPolicyOpen(false)} />}
  </div>
}

function ArrowHint() { return <span className="suggestion-arrow">&gt;</span> }