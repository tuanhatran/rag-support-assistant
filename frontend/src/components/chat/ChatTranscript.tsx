import { BookOpen, FileText, Shield, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { RefObject } from 'react'
import type { ChatSession, Message, Source } from '../../types/chat'
import { Markdown } from '../Markdown'

const suggestions = [
  'My VPN is stuck on Connecting, what should I do?',
  'My account keeps getting locked',
  'A pod is in CrashLoopBackOff with exit code 137',
  'The API gateway returns 403 Forbidden',
  'No space left on device on a Linux server',
]

interface ChatTranscriptProps {
  active: ChatSession | null
  sending: boolean
  endRef: RefObject<HTMLDivElement | null>
  onSendSuggestion: (question: string) => void
  onBrowseDocuments: () => void
  onOpenSource: (source: Source) => void
  onRate: (message: Message, rating: 'up' | 'down') => void
}

export function ChatTranscript({ active, sending, endRef, onSendSuggestion, onBrowseDocuments, onOpenSource, onRate }: ChatTranscriptProps) {
  return <div className="message-scroll">
    {(!active || !active.messages?.length) && <div className="welcome-state"><div className="welcome-icon"><Sparkles size={22} /></div><h2>Start with a question.</h2><p>Find the next practical step in your internal IT runbooks.</p><div className="suggestion-grid">{suggestions.map((item, index) => <button key={item} className="suggestion" onClick={() => onSendSuggestion(item)}><span>0{index + 1}</span>{item}<span className="suggestion-arrow">&gt;</span></button>)}</div><button className="browse-quiet" onClick={onBrowseDocuments}><FileText size={15} />Explore all support documents</button></div>}
    {active?.messages?.map((message, index) => <article className="exchange" key={message.id}>
      <div className="question-line"><span className="avatar user-avatar">Y</span><div className="question-bubble">{message.question}</div></div>
      <div className="answer-line"><span className="assistant-mark"><BookOpen size={15} /></span><div className="answer-content">
        <div className="answer-meta"><span>FIELDNOTE</span><span className="meta-dot">/</span><span>{message.model.model}</span><span className="meta-dot">/</span><span>{message.latency_ms} ms</span></div>
        {message.redacted && <div className="redaction-flag"><Shield size={13} />Sensitive data was redacted before processing</div>}
        {message.status === 'error' && <div className="error-banner">The configured model could not complete this answer.</div>}
        <Markdown>{message.answer}</Markdown>
        {!!message.sources.length && <div className="source-list"><span className="source-label">SOURCES</span>{message.sources.map((item, sourceIndex) => <button className="source-chip" key={`${item.document_id}-${item.section}`} onClick={() => onOpenSource(item)}><span>[{sourceIndex + 1}]</span>{item.document_title}<b>&gt;</b>{item.section}</button>)}</div>}
        <div className="answer-actions"><span>Was this useful?</span><button className="rating-button" title="Helpful" onClick={() => onRate(message, 'up')}><ThumbsUp size={14} /><span>Helpful</span></button><button className="rating-button" title="Not helpful" onClick={() => onRate(message, 'down')}><ThumbsDown size={14} /><span>Not helpful</span></button><span className="answer-count">{String(index + 1).padStart(2, '0')}</span></div>
      </div></div>
    </article>)}
    {sending && <div className="thinking"><span className="assistant-mark"><Sparkles size={15} /></span><span>Searching runbooks and preparing an answer</span><span className="thinking-dots"><i /><i /><i /></span></div>}
    <div ref={endRef} />
  </div>
}