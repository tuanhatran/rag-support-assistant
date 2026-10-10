import { Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import type { DocumentItem } from '../../types/documents'

interface DocumentListProps {
  documents: DocumentItem[]
  selectedId: string | null
  query: string
  category: string
  tag: string
  categories: string[]
  error: string
  onQueryChange: (query: string) => void
  onCategoryChange: (category: string) => void
  onTagChange: (tag: string) => void
  onOpen: (documentId: string) => void
}

export function DocumentList({
  documents,
  selectedId,
  query,
  category,
  tag,
  categories,
  error,
  onQueryChange,
  onCategoryChange,
  onTagChange,
  onOpen,
}: DocumentListProps) {
  return (
    <section className="document-list-panel">
      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search titles, steps, or tags"
            aria-label="Search documents"
          />
          {query && (
            <button className="icon-button" aria-label="Clear search" onClick={() => onQueryChange('')}>
              <X size={15} />
            </button>
          )}
        </label>
        <label className="select-wrap">
          <SlidersHorizontal size={15} />
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="document-items">
        {documents.map((item, index) => (
          <article className={`document-row ${selectedId === item.id ? 'chosen' : ''}`} key={item.id}>
            <button className="document-open" onClick={() => onOpen(item.id)}>
              <span className="document-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="document-main">
                <span className="document-category">{item.category}</span>
                <b>{item.title}</b>
                <small>{item.tags.slice(0, 4).join(' / ')}</small>
              </span>
              <span className="document-chevron">&gt;</span>
            </button>
            <div className="tag-row">
              {item.tags.map((itemTag) => (
                <button
                  className={`tag-chip ${tag === itemTag ? 'tag-selected' : ''}`}
                  key={itemTag}
                  onClick={() => onTagChange(tag === itemTag ? '' : itemTag)}
                >
                  <Tag size={11} />
                  {itemTag}
                </button>
              ))}
            </div>
          </article>
        ))}
        {documents.length === 0 && !error && (
          <div className="empty-documents">
            <Search size={24} />
            <b>No documents match</b>
            <span>Try another search or category.</span>
          </div>
        )}
      </div>
    </section>
  )
}
