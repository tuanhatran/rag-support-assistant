export type Plan = 'basic' | 'standard' | 'premium'
export type Role = 'user' | 'admin'

export interface User {
  id: string
  username: string
  role: Role
  plan: Plan
  model: string | null
  policy_version: string | null
  policy_accepted: boolean
}

export interface PlanOption {
  id: Plan
  description: string
  model: string | null
  connection: string | null
}