import { useState } from 'react'
import { BookOpenCheck, BookText, LogOut, MessageCircle, Shield, UserRound } from 'lucide-react'
import { AdminView } from './AdminView'
import { ChatView } from './ChatView'
import { DocumentsView } from './DocumentsView'
import { PolicyModal } from './PolicyModal'
import { PrivacyView } from './PrivacyView'
import type { User } from '../types/account'

type View = 'chat' | 'documents' | 'privacy' | 'admin'

interface AppShellProps {
  user: User
  onSignOut: () => void
  onDeleted: () => void
  onPolicyAccepted: () => void
}

export function AppShell({ user, onSignOut, onDeleted, onPolicyAccepted }: AppShellProps) {
  const [view, setView] = useState<View>('chat')
  const tabs: { id: View; label: string; icon: typeof MessageCircle }[] = [
    { id: 'chat', label: 'AI Chat', icon: MessageCircle },
    { id: 'documents', label: 'Documents', icon: BookText },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ]
  if (user.role === 'admin') tabs.push({ id: 'admin', label: 'Admin', icon: UserRound })

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#chat" onClick={event => { event.preventDefault(); setView('chat') }}><span className="brand-mark"><BookOpenCheck size={19} /></span><span>fieldnote<span className="brand-period">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation">{tabs.map(tab => <button key={tab.id} className={view === tab.id ? 'active' : ''} onClick={() => setView(tab.id)}><tab.icon size={16} /><span>{tab.label}</span></button>)}</nav>
      <div className="topbar-right"><span className="model-badge"><span className="status-dot" />{user.model ?? 'Model not assigned'}</span><div className="user-chip"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.username}<small>{user.plan} | {user.role}</small></span></div><button className="icon-button signout" title="Sign out" aria-label="Sign out" onClick={onSignOut}><LogOut size={17} /></button></div>
    </header>
    <main className="page-body">
      {view === 'chat' && <ChatView onBrowseDocuments={() => setView('documents')} />}
      {view === 'documents' && <DocumentsView />}
      {view === 'privacy' && <PrivacyView onDeleted={onDeleted} />}
      {view === 'admin' && user.role === 'admin' && <AdminView />}
    </main>
    {!user.policy_accepted && <PolicyModal blocking onAccept={onPolicyAccepted} />}
  </div>
}