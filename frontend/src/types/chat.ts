export type Rating = 'up' | 'down'

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
