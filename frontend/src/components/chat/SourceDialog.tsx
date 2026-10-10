import { X } from 'lucide-react'
import type { DocumentItem } from '../../types/documents'
import { Markdown } from '../Markdown'

export function SourceDialog({ source, onClose }: { source: DocumentItem; onClose: () => void }) {
  return <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal source-modal" role="dialog" aria-modal="true" aria-label={source.title}><div className="modal-head"><div><span className="eyebrow">{source.category} / KNOWLEDGE BASE</span><h2>{source.title}</h2></div><button className="icon-button" aria-label="Close document" onClick={onClose}><X size={18} /></button></div><div className="document-modal-body"><Markdown>{source.markdown ?? ''}</Markdown></div></section></div>
}