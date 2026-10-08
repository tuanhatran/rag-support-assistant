export type Plan = 'basic' | 'standard' | 'premium'
export type Role = 'user' | 'admin'
export type Rating = 'up' | 'down'

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

export interface Source {
  document_id: string
  document_title: string
  category?: string
  section: string
  score: number
  excerpt: string
}

export interface Message {
  id: string
  question: string
  answer: string
  status: 'ok' | 'error'
  sources: Source[]
  model: { name: string; provider: string; model: string }
  latency_ms: number
  redacted: boolean
  created_at: string
}

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages?: Message[]
}

export interface DocumentItem {
  id: string
  title: string
  category: string
  tags: string[]
  markdown?: string
}

export interface Connection {
  id: string
  name: string
  provider: 'mock' | 'openai' | 'azure_openai' | 'anthropic'
  model: string
  base_url: string
  api_version: string
  temperature: number
  max_tokens: number
  api_key_hint: string
  has_api_key: boolean
  plans: Plan[]
}

export interface Policy {
  version: string
  title: string
  retention: { conversations: number; feedback: number; audit: number }
  sections: { heading: string; text: string }[]
}
