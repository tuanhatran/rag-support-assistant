import { api } from '../api'
import type { Connection } from '../types/connections'
import type { Plan } from '../types/account'
import type { AdminUser, AuditEntry, AuditFilters, ConnectionForm, Feedback, FeedbackStats } from '../types/admin'

export const listConnections = () => api.get<Connection[]>('/admin/connections')
export const listUsers = () => api.get<AdminUser[]>('/admin/users')
export const listFeedback = (rating: string) =>
  api.get<Feedback[]>(`/admin/feedback${rating ? `?rating=${rating}` : ''}`)
export const getFeedbackStats = () => api.get<FeedbackStats>('/admin/feedback/stats')

export function listAudit(filters: AuditFilters) {
  const params = new URLSearchParams()
  if (filters.event.trim()) params.set('event', filters.event)
  if (filters.outcome.trim()) params.set('outcome', filters.outcome)
  if (filters.username.trim()) params.set('username', filters.username)
  return api.get<AuditEntry[]>(`/admin/audit?${params}`)
}

export const saveConnection = (id: string | null, payload: ConnectionForm) =>
  id ? api.patch(`/admin/connections/${id}`, payload) : api.post('/admin/connections', payload)
export const testConnection = (id: string) =>
  api.post<{ ok: boolean; message: string }>(`/admin/connections/${id}/test`)
export const deleteConnection = (id: string) => api.delete(`/admin/connections/${id}`)
export const updateUser = (id: string, changes: { role?: AdminUser['role']; plan?: Plan }) =>
  api.patch(`/admin/users/${id}`, changes)
