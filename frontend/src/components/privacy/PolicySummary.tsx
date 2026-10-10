import { FileLock2 } from 'lucide-react'
import type { Policy } from '../../types/privacy'

export function PolicySummary({ policy, onOpenFullPolicy }: { policy: Policy | null; onOpenFullPolicy: () => void }) {
  return (
    <section className="policy-section">
      <div className="section-title">
        <div>
          <span className="eyebrow">CURRENT POLICY</span>
          <h2>{policy?.title ?? 'Data policy'}</h2>
        </div>
        <FileLock2 size={19} />
      </div>
      {(policy?.sections ?? []).map((section, index) => (
        <article className="policy-row" key={section.heading}>
          <span className="policy-number">0{index + 1}</span>
          <div>
            <h3>{section.heading}</h3>
            <p>{section.text}</p>
          </div>
        </article>
      ))}
      <button className="text-link policy-full-link" onClick={onOpenFullPolicy}>
        Open full policy <span>&gt;</span>
      </button>
    </section>
  )
}
