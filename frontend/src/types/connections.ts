import type { Plan } from './account'

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