import type { User } from '../../src/types/account'
import type { AdminUser, Feedback as AdminFeedback } from '../../src/types/admin'
import type { ChatSession, Message } from '../../src/types/chat'
import type { Connection } from '../../src/types/connections'
import type { DocumentItem } from '../../src/types/documents'
import type { ChunkPreview, IngestionOptions, IngestionPipeline } from '../../src/types/ingestion'
import type { Policy } from '../../src/types/privacy'

const componentDocument: DocumentItem = {
  id: 'doc-1',
  title: 'VPN troubleshooting',
  category: 'Network',
  tags: ['vpn', 'access'],
  markdown: '# Reconnect\n\nRestart **the client**.',
}

const componentMessage: Message = {
  id: 'message-1',
  question: 'VPN fails',
  answer: 'Restart the client.',
  status: 'ok',
  sources: [
    {
      document_id: componentDocument.id,
      document_title: componentDocument.title,
      section: 'Reconnect',
      score: 1,
      excerpt: 'Restart.',
    },
  ],
  model: { name: 'Fieldnote', provider: 'mock', model: 'simulator' },
  latency_ms: 12,
  redacted: true,
  created_at: '2026-01-01T00:00:00Z',
}

const componentPolicy: Policy = {
  version: '2.1',
  title: 'Data policy',
  retention: { conversations: 90, feedback: 30, audit: 365 },
  sections: [{ heading: 'Retention', text: 'Data expires automatically.' }],
}

const componentConnection: Connection = {
  id: 'connection-1',
  name: 'Standard model',
  provider: 'openai',
  model: 'gpt-test',
  base_url: '',
  api_version: '',
  temperature: 0.2,
  max_tokens: 1000,
  api_key_hint: 'sk-...1234',
  has_api_key: true,
  plans: ['standard'],
}

const componentAdminUser: AdminUser = {
  id: 'user-1',
  username: 'ava',
  role: 'user',
  plan: 'standard',
  created_at: '2026-01-01T00:00:00Z',
}

const componentOptions: IngestionOptions = {
  models: [{ id: 'model-a', label: 'Model A', dimensions: 384, target: 'Cloudflare' }],
  separators: [{ value: '\n', label: 'Lines' }],
  chunk_size: { min: 100, max: 2000, default: 600 },
  chunk_overlap: { min: 0, default: 40 },
}

const componentStageInfo = { status: 'done' as const, latency_ms: 10 }

const componentPipeline: IngestionPipeline = {
  id: 'pipeline-1',
  filename: 'runbook.txt',
  file_size: 1024,
  status: 'completed',
  options: { chunk_size: 500, chunk_overlap: 50, separator: '\n', embedding_model: 'model-a' },
  stages: {
    file_parsing: componentStageInfo,
    chunking: componentStageInfo,
    embedding: componentStageInfo,
    database_ready: componentStageInfo,
  },
  chunk_count: 1,
  extracted_text: 'Sanitized runbook text',
  error: null,
  created_at: '2026-01-01T00:00:00Z',
  expires_at: null,
}

const componentChunk: ChunkPreview = { index: 0, content: 'Chunk text', model: 'model-a', dimensions: 384 }

const emptySession: ChatSession = {
  id: 'session-1',
  title: '',
  created_at: '',
  updated_at: '2026-01-01T00:00:00Z',
}

export const componentFixtures = {
  document: componentDocument,
  message: componentMessage,
  policy: componentPolicy,
  connection: componentConnection,
  adminUser: componentAdminUser,
  options: componentOptions,
  pipeline: componentPipeline,
  chunk: componentChunk,
  emptySession,
}

const standardUser: User = {
  id: 'user-1',
  username: 'ava',
  role: 'user',
  plan: 'standard',
  model: 'assistant',
  policy_version: '2.1',
  policy_accepted: true,
}

const viewAdminUser: User = { ...standardUser, id: 'admin-1', username: 'root', role: 'admin' }

const viewPolicy: Policy = {
  version: '2.1',
  title: 'Current data policy',
  retention: { conversations: 90, feedback: 30, audit: 365 },
  sections: [{ heading: 'Retention', text: 'Records expire after their retention period.' }],
}

const viewDocument: DocumentItem = {
  id: 'doc-1',
  title: 'VPN guide',
  category: 'Network',
  tags: ['vpn', 'access'],
  markdown: '# Reconnect\n\nRestart the client.',
}

const viewMessage: Message = {
  id: 'message-1',
  question: 'VPN broken',
  answer: 'Restart the client.',
  status: 'ok',
  sources: [
    {
      document_id: viewDocument.id,
      document_title: viewDocument.title,
      section: 'Reconnect',
      score: 1,
      excerpt: 'Restart.',
    },
  ],
  model: { name: 'Fieldnote', provider: 'mock', model: 'simulator' },
  latency_ms: 12,
  redacted: false,
  created_at: '2026-01-01',
}

const sentMessage: Message = { ...viewMessage, id: 'message-2' }

const viewSession: ChatSession = {
  id: 'session-1',
  title: 'VPN help',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  messages: [viewMessage],
}

const viewConnection: Connection = {
  id: 'connection-1',
  name: 'Standard',
  provider: 'mock',
  model: 'simulator',
  base_url: '',
  api_version: '',
  temperature: 0,
  max_tokens: 1000,
  api_key_hint: '',
  has_api_key: false,
  plans: ['standard'],
}

const account: AdminUser = {
  id: 'account-1',
  username: 'casey',
  role: 'user',
  plan: 'standard',
  created_at: '2026-01-01',
}

const feedback: AdminFeedback = {
  session_id: 'session-1',
  message_id: 'message-1',
  username: 'ava',
  rating: 'up',
  categories: [],
  comment: '',
  question: 'VPN broken',
  answer: 'Restart it.',
  model: { model: 'simulator' },
  created_at: '2026-01-01',
}

const ingestionOptions: IngestionOptions = {
  models: [{ id: 'model-a', label: 'Model A', dimensions: 384, target: 'Cloudflare' }],
  separators: [{ value: '\n\n', label: 'Paragraphs' }],
  chunk_size: { min: 100, max: 2000, default: 500 },
  chunk_overlap: { min: 0, default: 50 },
}

const viewStageInfo = { status: 'done' as const, latency_ms: 2 }

const viewPipeline: IngestionPipeline = {
  id: 'pipeline-1',
  filename: 'runbook.txt',
  file_size: 1024,
  status: 'completed',
  options: { chunk_size: 500, chunk_overlap: 50, separator: '\n\n', embedding_model: 'model-a' },
  stages: {
    file_parsing: viewStageInfo,
    chunking: { status: 'done', latency_ms: 3 },
    embedding: { status: 'done', latency_ms: 4 },
    database_ready: { status: 'done', latency_ms: 5 },
  },
  chunk_count: 1,
  extracted_text: 'Redacted source text',
  error: null,
  created_at: '2026-01-01',
  expires_at: null,
}

const viewChunk: ChunkPreview = { index: 0, content: 'Chunk body', model: 'model-a', dimensions: 384 }

export const viewFixtures = {
  standardUser,
  adminUser: viewAdminUser,
  policy: viewPolicy,
  document: viewDocument,
  message: viewMessage,
  sentMessage,
  session: viewSession,
  connection: viewConnection,
  account,
  feedback,
  ingestionOptions,
  pipeline: viewPipeline,
  chunk: viewChunk,
}
