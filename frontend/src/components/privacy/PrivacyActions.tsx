import type { FormEvent } from 'react'
import { AlertTriangle, Download, Trash2 } from 'lucide-react'

interface PrivacyActionsProps {
  busy: boolean
  password: string
  onPasswordChange: (password: string) => void
  onExport: () => void
  onErase: () => void
  onDeleteAccount: (event: FormEvent<HTMLFormElement>) => void
}

export function PrivacyActions({
  busy,
  password,
  onPasswordChange,
  onExport,
  onErase,
  onDeleteAccount,
}: PrivacyActionsProps) {
  return (
    <aside className="privacy-actions">
      <div className="section-title">
        <div>
          <span className="eyebrow">YOUR DATA</span>
          <h2>Available actions</h2>
        </div>
      </div>
      <article className="privacy-action">
        <span className="action-icon">
          <Download size={17} />
        </span>
        <div>
          <h3>Export my data</h3>
          <p>Download your profile, conversations, and feedback as JSON.</p>
          <button className="button button-small" onClick={onExport}>
            Export data <Download size={14} />
          </button>
        </div>
      </article>
      <article className="privacy-action">
        <span className="action-icon">
          <Trash2 size={17} />
        </span>
        <div>
          <h3>Delete my conversations</h3>
          <p>Erase your conversations and feedback. Audit records remain until they expire.</p>
          <button className="button button-small button-danger" onClick={onErase} disabled={busy}>
            Delete conversations <Trash2 size={14} />
          </button>
        </div>
      </article>
      <form className="account-delete" onSubmit={onDeleteAccount}>
        <div className="danger-heading">
          <AlertTriangle size={16} />
          <h3>Delete account</h3>
        </div>
        <p>Removes your account and personal support data. Your password is required.</p>
        <label className="field-label">
          Confirm password
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="button button-danger" disabled={busy || !password}>
          Delete account permanently
        </button>
      </form>
    </aside>
  )
}
