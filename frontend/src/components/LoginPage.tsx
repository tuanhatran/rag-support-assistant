import { FormEvent, useEffect, useState } from 'react'
import { ArrowUpRight, BookOpenCheck, ShieldCheck } from 'lucide-react'
import { api } from '../api'
import type { PlanOption, User } from '../types'
import { PolicyModal } from './PolicyModal'

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'signin' | 'create'>('signin')
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [plan, setPlan] = useState<'basic' | 'standard' | 'premium'>('standard')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get<PlanOption[]>('/auth/plans').then(setPlans).catch(() => setPlans([])) }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (mode === 'create' && password !== confirmation) return setError('Passwords do not match.')
    if (mode === 'create' && !accepted) return setError('Accept the data policy to create an account.')
    setBusy(true)
    try {
      const user = await api.post<User>(mode === 'create' ? '/auth/register' : '/auth/login',
        mode === 'create' ? { username, password, plan, policy_accepted: accepted } : { username, password })
      onAuthenticated(user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.')
    } finally { setBusy(false) }
  }

  return <main className="auth-shell">
    <section className="auth-aside">
      <div className="brand brand-large"><span className="brand-mark"><BookOpenCheck size={22} /></span><span>fieldnote<span className="brand-period">.</span></span></div>
      <div className="auth-aside-copy"><span className="eyebrow">INTERNAL SUPPORT KNOWLEDGE</span><h1>Good answers<br />start with <em>evidence.</em></h1><p>Get practical IT guidance from the runbooks your teams already trust.</p></div>
      <div className="aside-foot"><span><ShieldCheck size={16} /> Private by design</span><span className="mono">SUPPORT SYSTEMS / 01</span></div>
      <div className="aside-grid" aria-hidden="true" />
    </section>
    <section className="auth-main">
      <div className="auth-form-wrap">
        <div className="auth-heading"><span className="eyebrow">FIELDNOTE SUPPORT DESK</span><h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p>Sign in to continue to your support workspace.</p></div>
        <div className="segmented auth-tabs" role="tablist"><button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setError('') }}>Sign in</button><button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'selected' : ''} onClick={() => { setMode('create'); setError('') }}>Create account</button></div>
        <form onSubmit={submit} className="auth-form">
          <label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required minLength={mode === 'create' ? 3 : 1} maxLength={40} /></label>
          <label>Password<input type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === 'create' ? 12 : 1} /></label>
          {mode === 'create' && <>
            <label>Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={12} /></label>
            <fieldset className="plan-picker"><legend>Choose a support plan</legend><div className="plan-options">{(['basic', 'standard', 'premium'] as const).map(key => {
              const item = plans.find(candidate => candidate.id === key)
              return <button type="button" key={key} className={`plan-option ${plan === key ? 'selected' : ''}`} onClick={() => setPlan(key)}><span className="plan-radio" /><span className="plan-name">{key}</span><span className="plan-description">{item?.description ?? 'Support model access'}</span><small>{item?.model ?? 'Model unavailable'}</small></button>
            })}</div></fieldset>
            <label className="check-row"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>I accept the <button type="button" className="text-link" onClick={() => setPolicyOpen(true)}>data policy</button>.</span></label>
          </>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowUpRight size={17} /></button>
        </form>
        <p className="auth-note">Your session is protected with an HttpOnly cookie. Support history is private to your account.</p>
      </div>
      <div className="auth-bottom"><span>IT SUPPORT / KNOWLEDGE ASSISTANT</span><span>INTERNAL USE</span></div>
    </section>
    {policyOpen && <PolicyModal onClose={() => setPolicyOpen(false)} />}
  </main>
}
