import { FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, Download, FileLock2, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../api'
import type { Policy } from '../types'
import { PolicyModal } from './PolicyModal'

export function PrivacyView({ onDeleted }: { onDeleted: () => void }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [policyOpen, setPolicyOpen] = useState(false)

  useEffect(() => { api.get<Policy>('/privacy/policy').then(setPolicy).catch(reason => setError(reason.message)) }, [])

  async function exportData() {
    setError(''); setNotice('')
    try {
      const data = await api.get<unknown>('/privacy/data')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'fieldnote-my-data.json'; link.click(); URL.revokeObjectURL(url)
      setNotice('Your export has been prepared.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed.') }
  }

  async function eraseData() {
    if (!window.confirm('Delete all your conversations and feedback? This cannot be undone.')) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await api.delete<{ conversations_deleted: number; feedback_deleted: number }>('/privacy/data'); setNotice(`Deleted ${result.conversations_deleted} conversations and ${result.feedback_deleted} feedback records.`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Data erasure failed.') }
    finally { setBusy(false) }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    if (!window.confirm('Permanently delete your account? This cannot be undone.')) return
    setBusy(true); setError('')
    try { await api.post('/privacy/account/delete', { password }); onDeleted() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Account deletion failed.') }
    finally { setBusy(false) }
  }

  return <div className="content-page privacy-page">
    <div className="page-heading"><div><span className="eyebrow">ACCOUNT / DATA RIGHTS</span><h1>Privacy &amp; data</h1><p>Review what is stored and take action on your support history.</p></div><div className="privacy-stamp"><ShieldCheck size={20} /><span>POLICY VERSION<br /><b>{policy?.version ?? 'Loading'}</b></span></div></div>
    {error && <div className="form-error page-alert">{error}</div>}{notice && <div className="inline-success page-alert">{notice}</div>}
    <div className="privacy-grid">
      <section className="policy-section"><div className="section-title"><div><span className="eyebrow">CURRENT POLICY</span><h2>{policy?.title ?? 'Data policy'}</h2></div><FileLock2 size={19} /></div>
        {(policy?.sections ?? []).map((section, index) => <article className="policy-row" key={section.heading}><span className="policy-number">0{index + 1}</span><div><h3>{section.heading}</h3><p>{section.text}</p></div></article>)}
        <button className="text-link policy-full-link" onClick={() => setPolicyOpen(true)}>Open full policy <span>&gt;</span></button>
      </section>
      <aside className="privacy-actions">
        <div className="section-title"><div><span className="eyebrow">YOUR DATA</span><h2>Available actions</h2></div></div>
        <article className="privacy-action"><span className="action-icon"><Download size={17} /></span><div><h3>Export my data</h3><p>Download your profile, conversations, and feedback as JSON.</p><button className="button button-small" onClick={exportData}>Export data <Download size={14} /></button></div></article>
        <article className="privacy-action"><span className="action-icon"><Trash2 size={17} /></span><div><h3>Delete my conversations</h3><p>Erase your conversations and feedback. Audit records remain until they expire.</p><button className="button button-small button-danger" onClick={eraseData} disabled={busy}>Delete conversations <Trash2 size={14} /></button></div></article>
        <form className="account-delete" onSubmit={deleteAccount}><div className="danger-heading"><AlertTriangle size={16} /><h3>Delete account</h3></div><p>Removes your account and personal support data. Your password is required.</p><label className="field-label">Confirm password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label><button className="button button-danger" disabled={busy || !password}>Delete account permanently</button></form>
      </aside>
    </div>
    {policyOpen && <PolicyModal onClose={() => setPolicyOpen(false)} />}
  </div>
}
