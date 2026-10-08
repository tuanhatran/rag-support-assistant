import { useEffect, useState } from 'react'
import { BookOpenCheck, BookText, LogOut, MessageCircle, Shield, UserRound } from 'lucide-react'
import { api, setUnauthorizedHandler } from './api'
import { AdminView } from './components/AdminView'
import { ChatView } from './components/ChatView'
import { DocumentsView } from './components/DocumentsView'
import { LoginPage } from './components/LoginPage'
import { PolicyModal } from './components/PolicyModal'
import { PrivacyView } from './components/PrivacyView'
import type { User } from './types'

type View = 'chat' | 'documents' | 'privacy' | 'admin'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('chat')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    api.get<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
    return () => setUnauthorizedHandler(null)
  }, [])

  async function signOut() {
    try { await api.post('/auth/logout') } catch { /* The local session still needs to close. */ }
    setUser(null)
  }

  if (loading) return <div className="loading-screen"><span className="brand-mark"><BookOpenCheck size={21} /></span><span>Opening your workspace...</span></div>
  if (!user) return <LoginPage onAuthenticated={setUser} />

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
      <div className="topbar-right"><span className="model-badge"><span className="status-dot" />{user.model ?? 'Model not assigned'}</span><div className="user-chip"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.username}<small>{user.plan} | {user.role}</small></span></div><button className="icon-button signout" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
    </header>
    <main className="page-body">
      {view === 'chat' && <ChatView onBrowseDocuments={() => setView('documents')} />}
      {view === 'documents' && <DocumentsView />}
      {view === 'privacy' && <PrivacyView onDeleted={() => setUser(null)} />}
      {view === 'admin' && user.role === 'admin' && <AdminView />}
    </main>
    {!user.policy_accepted && <PolicyModal blocking onAccept={() => setUser({ ...user, policy_accepted: true })} />}
  </div>
}