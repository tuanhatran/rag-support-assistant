import type { Connection } from './connections'
import type { Plan } from './account'

export type AdminUser = { id: string; username: string; role: 'user' | 'admin'; plan: Plan; created_at?: string }
export type Feedback = {
  session_id: string
  message_id: string
  username: string
  rating: 'up' | 'down'
  categories: string[]
  comment: string
  question: string
  answer: string
  model: { model: string }
  created_at: string
}
export type AuditEntry = {
  timestamp: string
  event: string
  outcome: string
  actor?: { username: string }
  target?: Record<string, string>
  details?: Record<string, string>
  request_id?: string
}
export type AuditFilters = { event: string; outcome: string; username: string }
export type FeedbackStats = { total: number; helpful: number; not_helpful: number; satisfaction_percent: number }
export type ConnectionForm = Omit<Connection, 'id' | 'api_key_hint' | 'has_api_key'> & {
  api_key: string
  remove_api_key: boolean
}
