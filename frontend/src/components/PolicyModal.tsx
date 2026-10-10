import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { acceptPolicy, getPolicy } from '../api/privacy'
import type { Policy } from '../types/privacy'

export function PolicyModal({ blocking, onAccept, onClose }: { blocking?: boolean; onAccept?: () => void; onClose?: () => void }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPolicy().then(setPolicy).catch(() => setPolicy(null))
  }, [])

  async function accept() {
    if (!onAccept) return
    setBusy(true)
    try {
      await acceptPolicy()
      onAccept()
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-scrim" role="presentation">
    <section className="modal policy-modal" role="dialog" aria-modal="true" aria-labelledby="policy-title">
      <div className="modal-head">
        <div><span className="eyebrow">DATA POLICY / {policy?.version ?? 'CURRENT'}</span><h2 id="policy-title">{policy?.title ?? 'Data policy'}</h2></div>
        {!blocking && <button className="icon-button" aria-label="Close policy" onClick={onClose}><X size={18} /></button>}
      </div>
      <div className="policy-copy">
        {(policy?.sections ?? []).map(section => <section key={section.heading}><h3>{section.heading}</h3><p>{section.text}</p></section>)}
        {!policy && <p>Loading the current policy...</p>}
      </div>
      {blocking && <div className="modal-actions"><span className="muted">You must accept the current policy to continue.</span><button className="button button-primary" onClick={accept} disabled={busy || !policy}><Check size={16} />{busy ? 'Saving...' : 'Accept policy'}</button></div>}
    </section>
  </div>
}
