import type { Plan } from '../../types/account'
import type { AdminUser, ConnectionForm } from '../../types/admin'
export type { AdminUser, AuditEntry, AuditFilters, ConnectionForm, Feedback, FeedbackStats } from '../../types/admin'

export type AdminTab = 'connections' | 'ingestion' | 'users' | 'feedback' | 'audit'
export type UserEdit = Pick<AdminUser, 'role' | 'plan'>

export const blankConnection: ConnectionForm = {
  name: '',
  provider: 'mock',
  model: 'extractive-simulator',
  base_url: '',
  api_version: '',
  api_key: '',
  remove_api_key: false,
  temperature: 0,
  max_tokens: 1200,
  plans: ['basic', 'standard', 'premium'],
}
export const planLabels: { id: Plan; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'standard', label: 'Standard' },
  { id: 'premium', label: 'Premium' },
]
