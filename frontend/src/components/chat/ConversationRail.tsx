import { BookOpen, ChevronDown, MessageSquarePlus, Plus, Trash2 } from 'lucide-react'
import type { ChatSession } from '../../types/chat'

interface ConversationRailProps {
  sessions: ChatSession[]
  activeSessionId?: string
  loading: boolean
  onCreate: () => void
  onSelect: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  onBrowseDocuments: () => void
}

export function ConversationRail({ sessions, activeSessionId, loading, onCreate, onSelect, onDelete, onBrowseDocuments }: ConversationRailProps) {
  return <aside className="conversation-rail">
    <div className="rail-heading"><div><span className="eyebrow">WORKSPACE</span><h2>Conversations</h2></div><button className="icon-button icon-accent" aria-label="New conversation" title="New conversation" onClick={onCreate}><MessageSquarePlus size={18} /></button></div>
    <button className="button new-thread" onClick={onCreate}><Plus size={16} />New conversation</button>
    <div className="thread-list" aria-label="Conversation history">
      {loading && <div className="rail-empty">Loading history...</div>}
      {!loading && sessions.length === 0 && <div className="rail-empty">Your recent conversations will appear here.</div>}
      {sessions.map(item => <div className={`thread-row ${activeSessionId === item.id ? 'current' : ''}`} key={item.id}>
        <button className="thread-select" onClick={() => onSelect(item.id)}><span>{item.title || 'New conversation'}</span><small>{new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></button>
        <button className="icon-button thread-delete" title="Delete conversation" aria-label={`Delete ${item.title}`} onClick={() => onDelete(item.id)}><Trash2 size={14} /></button>
      </div>)}
    </div>
    <div className="rail-bottom"><div className="knowledge-note"><BookOpen size={17} /><span><b>Grounded in runbooks</b><small>Answers link back to their source.</small></span></div><button className="text-button" onClick={onBrowseDocuments}>Browse knowledge base <ChevronDown size={14} className="rotate-icon" /></button></div>
  </aside>
}