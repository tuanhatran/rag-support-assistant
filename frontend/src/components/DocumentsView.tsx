import { useEffect, useState } from 'react'
import { BookOpenText, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import { api } from '../api'
import type { DocumentItem } from '../types'
import { Markdown } from './Markdown'

export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selected, setSelected] = useState<DocumentItem | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (category !== 'All categories') params.set('category', category)
    if (tag) params.set('tag', tag)
    if (query.trim()) params.set('q', query.trim())
    api.get<DocumentItem[]>(`/documents?${params}`).then(setDocuments).catch(reason => setError(reason.message))
  }, [category, tag, query])

  const categories = ['All categories', 'Network', 'Identity & Access', 'Collaboration', 'Workplace', 'Platform Engineering', 'API Management']

  async function openDocument(id: string) {
    try { setSelected(await api.get<DocumentItem>(`/documents/${id}`)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the document.') }
  }

  return <div className="content-page documents-page">
    <div className="page-heading"><div><span className="eyebrow">KNOWLEDGE BASE / 10 RUNBOOKS</span><h1>Support documents</h1><p>Operational guidance from internal troubleshooting runbooks.</p></div><div className="document-count"><BookOpenText size={18} /><b>{documents.length.toString().padStart(2, '0')}</b><span>visible</span></div></div>
    <div className="document-browser">
      <section className="document-list-panel">
        <div className="filter-bar"><label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, steps, or tags" aria-label="Search documents" />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}</label><label className="select-wrap"><SlidersHorizontal size={15} /><select value={category} onChange={event => { setCategory(event.target.value); setTag('') }} aria-label="Filter by category">{categories.map(item => <option key={item}>{item}</option>)}</select></label></div>
        {error && <div className="form-error">{error}</div>}
        <div className="document-items">{documents.map((item, index) => <article className={`document-row ${selected?.id === item.id ? 'chosen' : ''}`} key={item.id}>
          <button className="document-open" onClick={() => openDocument(item.id)}><span className="document-index">{String(index + 1).padStart(2, '0')}</span><span className="document-main"><span className="document-category">{item.category}</span><b>{item.title}</b><small>{item.tags.slice(0, 4).join(' / ')}</small></span><span className="document-chevron">&gt;</span></button>
          <div className="tag-row">{item.tags.map(itemTag => <button className={`tag-chip ${tag === itemTag ? 'tag-selected' : ''}`} key={itemTag} onClick={() => setTag(current => current === itemTag ? '' : itemTag)}><Tag size={11} />{itemTag}</button>)}</div>
        </article>)}{documents.length === 0 && !error && <div className="empty-documents"><Search size={24} /><b>No documents match</b><span>Try another search or category.</span></div>}</div>
      </section>
      <section className="document-reader" aria-live="polite">{selected ? <><div className="reader-head"><div><span className="eyebrow">{selected.category}</span><h2>{selected.title}</h2></div><button className="icon-button" aria-label="Close document" onClick={() => setSelected(null)}><X size={17} /></button></div><div className="reader-tags">{selected.tags.map(item => <span className="tag-chip static-tag" key={item}>{item}</span>)}</div><div className="reader-content"><Markdown>{selected.markdown ?? ''}</Markdown></div></> : <div className="reader-empty"><div className="reader-empty-icon"><BookOpenText size={21} /></div><span className="eyebrow">RUNBOOK LIBRARY</span><h2>Choose a document</h2><p>Select a runbook to read its full steps and escalation notes.</p><span className="reader-rule" /></div>}</section>
    </div>
  </div>
}
