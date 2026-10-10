import { useState } from 'react'
import { BookOpenCheck, ShieldCheck } from 'lucide-react'
import type { User } from '../types/account'
import { AccountForm } from './auth/AccountForm'
import { PolicyModal } from './PolicyModal'

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [policyOpen, setPolicyOpen] = useState(false)

  return <main className="auth-shell">
    <section className="auth-aside">
      <div className="brand brand-large"><span className="brand-mark"><BookOpenCheck size={22} /></span><span>fieldnote<span className="brand-period">.</span></span></div>
      <div className="auth-aside-copy"><span className="eyebrow">INTERNAL SUPPORT KNOWLEDGE</span><h1>Good answers<br />start with <em>evidence.</em></h1><p>Get practical IT guidance from the runbooks your teams already trust.</p></div>
      <div className="aside-foot"><span><ShieldCheck size={16} /> Private by design</span><span className="mono">SUPPORT SYSTEMS / 01</span></div>
      <div className="aside-grid" aria-hidden="true" />
    </section>
    <section className="auth-main">
      <AccountForm onAuthenticated={onAuthenticated} onOpenPolicy={() => setPolicyOpen(true)} />
      <div className="auth-bottom"><span>IT SUPPORT / KNOWLEDGE ASSISTANT</span><span>INTERNAL USE</span></div>
    </section>
    {policyOpen && <PolicyModal onClose={() => setPolicyOpen(false)} />}
  </main>
}
