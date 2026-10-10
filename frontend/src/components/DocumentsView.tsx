import { useEffect, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { getDocument, listDocuments } from '../api/documents'
import type { DocumentItem } from '../types/documents'
import { DocumentList } from './documents/DocumentList'
import { DocumentReader } from './documents/DocumentReader'

export function DocumentsView() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [selected, setSelected] = useState<DocumentItem | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    listDocuments({ query, category, tag })
      .then(setDocuments)
      .catch((reason) => setError(reason.message))
  }, [category, tag, query])

  const categories = [
    'All categories',
    'Network',
    'Identity & Access',
    'Collaboration',
    'Workplace',
    'Platform Engineering',
    'API Management',
  ]

  async function openDocument(id: string) {
    try {
      setSelected(await getDocument(id))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the document.')
    }
  }

  return (
    <div className="content-page documents-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE BASE / 10 RUNBOOKS</span>
          <h1>Support documents</h1>
          <p>Operational guidance from internal troubleshooting runbooks.</p>
        </div>
        <div className="document-count">
          <BookOpenText size={18} />
          <b>{documents.length.toString().padStart(2, '0')}</b>
          <span>visible</span>
        </div>
      </div>
      <div className="document-browser">
        <DocumentList
          documents={documents}
          selectedId={selected?.id ?? null}
          query={query}
          category={category}
          tag={tag}
          categories={categories}
          error={error}
          onQueryChange={setQuery}
          onCategoryChange={(value) => {
            setCategory(value)
            setTag('')
          }}
          onTagChange={setTag}
          onOpen={openDocument}
        />
        <DocumentReader document={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}
