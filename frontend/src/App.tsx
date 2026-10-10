import { useEffect, useState } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { setUnauthorizedHandler } from './api'
import { getCurrentUser, signOut as signOutRequest } from './api/auth'
import { AppShell } from './components/AppShell'
import { LoginPage } from './components/LoginPage'
import type { User } from './types/account'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
    return () => setUnauthorizedHandler(null)
  }, [])

  async function signOut() {
    try { await signOutRequest() } catch { /* The local session still needs to close. */ }
    setUser(null)
  }

  if (loading) return <div className="loading-screen"><span className="brand-mark"><BookOpenCheck size={21} /></span><span>Opening your workspace...</span></div>
  if (!user) return <LoginPage onAuthenticated={setUser} />

  return <AppShell
    user={user}
    onSignOut={signOut}
    onDeleted={() => setUser(null)}
    onPolicyAccepted={() => setUser(current => current ? { ...current, policy_accepted: true } : current)}
  />
}