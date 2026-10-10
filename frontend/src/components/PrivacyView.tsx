import { FormEvent, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { deleteUserAccount, eraseUserData, exportUserData, getPolicy } from '../api/privacy'
import type { Policy } from '../types/privacy'
import { PolicySummary } from './privacy/PolicySummary'
import { PrivacyActions } from './privacy/PrivacyActions'
import { PolicyModal } from './PolicyModal'

export function PrivacyView({ onDeleted }: { onDeleted: () => void }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [policyOpen, setPolicyOpen] = useState(false)

  useEffect(() => {
    getPolicy()
      .then(setPolicy)
      .catch((reason) => setError(reason.message))
  }, [])

  async function exportData() {
    setError('')
    setNotice('')
    try {
      const data = await exportUserData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'fieldnote-my-data.json'
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Your export has been prepared.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.')
    }
  }

  async function eraseData() {
    if (!window.confirm('Delete all your conversations and feedback? This cannot be undone.')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await eraseUserData()
      setNotice(
        `Deleted ${result.conversations_deleted} conversations and ${result.feedback_deleted} feedback records.`,
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Data erasure failed.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    if (!window.confirm('Permanently delete your account? This cannot be undone.')) return
    setBusy(true)
    setError('')
    try {
      await deleteUserAccount(password)
      onDeleted()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Account deletion failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content-page privacy-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCOUNT / DATA RIGHTS</span>
          <h1>Privacy &amp; data</h1>
          <p>Review what is stored and take action on your support history.</p>
        </div>
        <div className="privacy-stamp">
          <ShieldCheck size={20} />
          <span>
            POLICY VERSION
            <br />
            <b>{policy?.version ?? 'Loading'}</b>
          </span>
        </div>
      </div>
      {error && <div className="form-error page-alert">{error}</div>}
      {notice && <div className="inline-success page-alert">{notice}</div>}
      <div className="privacy-grid">
        <PolicySummary policy={policy} onOpenFullPolicy={() => setPolicyOpen(true)} />
        <PrivacyActions
          busy={busy}
          password={password}
          onPasswordChange={setPassword}
          onExport={exportData}
          onErase={eraseData}
          onDeleteAccount={deleteAccount}
        />
      </div>
      {policyOpen && <PolicyModal onClose={() => setPolicyOpen(false)} />}
    </div>
  )
}
