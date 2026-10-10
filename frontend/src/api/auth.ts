import { api } from '../api'
import type { Plan, PlanOption, User } from '../types/account'

export const getCurrentUser = () => api.get<User>('/auth/me')
export const getPlanOptions = () => api.get<PlanOption[]>('/auth/plans')
export const signIn = (username: string, password: string) => api.post<User>('/auth/login', { username, password })
export const register = (username: string, password: string, plan: Plan) =>
  api.post<User>('/auth/register', { username, password, plan, policy_accepted: true })
export const signOut = () => api.post('/auth/logout')