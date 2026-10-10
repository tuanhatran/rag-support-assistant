import { api } from '../api'
import type { Policy } from '../types/privacy'

export interface ErasedDataCounts {
  conversations_deleted: number
  feedback_deleted: number
}

export const getPolicy = () => api.get<Policy>('/privacy/policy')
export const acceptPolicy = () => api.post('/privacy/consent', { accepted: true })
export const exportUserData = () => api.get<unknown>('/privacy/data')
export const eraseUserData = () => api.delete<ErasedDataCounts>('/privacy/data')
export const deleteUserAccount = (password: string) => api.post('/privacy/account/delete', { password })