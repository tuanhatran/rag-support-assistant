import { BookOpenText, X } from 'lucide-react'
import type { DocumentItem } from '../../types/documents'
import { Markdown } from '../Markdown'

export function DocumentReader({ document, onClose }: { document: DocumentItem | null; onClose: () => void }) {
  return <section className="document-reader" aria-live="polite">{document ? <><div className="reader-head"><div><span className="eyebrow">{document.category}</span><h2>{document.title}</h2></div><button className="icon-button" aria-label="Close document" onClick={onClose}><X size={17} /></button></div><div className="reader-tags">{document.tags.map(item => <span className="tag-chip static-tag" key={item}>{item}</span>)}</div><div className="reader-content"><Markdown>{document.markdown ?? ''}</Markdown></div></> : <div className="reader-empty"><div className="reader-empty-icon"><BookOpenText size={21} /></div><span className="eyebrow">RUNBOOK LIBRARY</span><h2>Choose a document</h2><p>Select a runbook to read its full steps and escalation notes.</p><span className="reader-rule" /></div>}</section>
}