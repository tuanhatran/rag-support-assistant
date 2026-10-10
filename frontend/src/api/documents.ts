import { api } from '../api'
import type { DocumentItem } from '../types/documents'

export interface DocumentFilters {
  query: string
  category: string
  tag: string
}

export function listDocuments(filters: DocumentFilters) {
  const params = new URLSearchParams()
  if (filters.category !== 'All categories') params.set('category', filters.category)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.query.trim()) params.set('q', filters.query.trim())
  return api.get<DocumentItem[]>(`/documents?${params}`)
}

export const getDocument = (documentId: string) => api.get<DocumentItem>(`/documents/${documentId}`)