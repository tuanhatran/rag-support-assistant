import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { AppShell } from '../src/components/AppShell'
import { AccountForm } from '../src/components/auth/AccountForm'
import { ChatView } from '../src/components/ChatView'
import { DocumentsView } from '../src/components/DocumentsView'
import { PrivacyView } from '../src/components/PrivacyView'
import { AdminView } from '../src/components/AdminView'
import { IngestionView } from '../src/components/IngestionView'
import { IngestionPipelineView } from '../src/components/IngestionPipelineView'
import * as authApi from '../src/api/auth'
import * as chatApi from '../src/api/chat'
import * as documentApi from '../src/api/documents'
import * as privacyApi from '../src/api/privacy'
import * as adminApi from '../src/api/admin'
import * as ingestionApi from '../src/api/ingestion'
import type { User } from '../src/types/account'
import type { Connection } from '../src/types/connections'
import type { AdminUser, AuditEntry, Feedback as AdminFeedback } from '../src/types/admin'
import type { ChatSession, Message } from '../src/types/chat'
import type { DocumentItem } from '../src/types/documents'
import type { Policy } from '../src/types/privacy'
import type { ChunkPreview, IngestionOptions, IngestionPipeline, PipelineSummary } from '../src/types/ingestion'

const user = userEvent.setup

const standardUser: User = {
  id: 'user-1',
  username: 'ava',
  role: 'user',
  plan: 'standard',
  model: 'assistant',
  policy_version: '2.1',
  policy_accepted: true,
}
const adminUser: User = { ...standardUser, id: 'admin-1', username: 'root', role: 'admin' }
const policy: Policy = {
  version: '2.1',
  title: 'Current data policy',
  retention: { conversations: 90, feedback: 30, audit: 365 },
  sections: [{ heading: 'Retention', text: 'Records expire after their retention period.' }],
}
const document: DocumentItem = {
  id: 'doc-1',
  title: 'VPN guide',
  category: 'Network',
  tags: ['vpn', 'access'],
  markdown: '# Reconnect\n\nRestart the client.',
}
const message: Message = {
  id: 'message-1',
  question: 'VPN broken',
  answer: 'Restart the client.',
  status: 'ok',
  sources: [
    { document_id: document.id, document_title: document.title, section: 'Reconnect', score: 1, excerpt: 'Restart.' },
  ],
  model: { name: 'Fieldnote', provider: 'mock', model: 'simulator' },
  latency_ms: 12,
  redacted: false,
  created_at: '2026-01-01',
}
const sentMessage: Message = { ...message, id: 'message-2' }
const session: ChatSession = {
  id: 'session-1',
  title: 'VPN help',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  messages: [message],
}
const connection: Connection = {
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
const stages = {
  file_parsing: { status: 'done' as const, latency_ms: 2 },
  chunking: { status: 'done' as const, latency_ms: 3 },
  embedding: { status: 'done' as const, latency_ms: 4 },
  database_ready: { status: 'done' as const, latency_ms: 5 },
}
const pipeline: IngestionPipeline = {
  id: 'pipeline-1',
  filename: 'runbook.txt',
  file_size: 1024,
  status: 'completed',
  options: { chunk_size: 500, chunk_overlap: 50, separator: '\n\n', embedding_model: 'model-a' },
  stages,
  chunk_count: 1,
  extracted_text: 'Redacted source text',
  error: null,
  created_at: '2026-01-01',
  expires_at: null,
}
const chunk: ChunkPreview = { index: 0, content: 'Chunk body', model: 'model-a', dimensions: 384 }

beforeEach(() => {
  vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue(standardUser)
  vi.spyOn(authApi, 'getPlanOptions').mockResolvedValue([
    { id: 'basic', description: 'Basic access', model: null, connection: null },
    { id: 'standard', description: 'Standard access', model: 'assistant', connection: 'main' },
    { id: 'premium', description: 'Premium access', model: 'advanced', connection: 'plus' },
  ])
  vi.spyOn(authApi, 'signIn').mockResolvedValue(standardUser)
  vi.spyOn(authApi, 'register').mockResolvedValue(standardUser)
  vi.spyOn(authApi, 'signOut').mockResolvedValue(undefined)

  vi.spyOn(chatApi, 'listSessions').mockResolvedValue([])
  vi.spyOn(chatApi, 'getSession').mockResolvedValue(session)
  vi.spyOn(chatApi, 'createSession').mockResolvedValue({
    ...session,
    id: 'created-1',
    title: 'New conversation',
    messages: [],
  })
  vi.spyOn(chatApi, 'deleteSession').mockResolvedValue(undefined)
  vi.spyOn(chatApi, 'sendMessage').mockResolvedValue(sentMessage)
  vi.spyOn(chatApi, 'submitFeedback').mockResolvedValue(undefined)

  vi.spyOn(documentApi, 'listDocuments').mockResolvedValue([])
  vi.spyOn(documentApi, 'getDocument').mockResolvedValue(document)
  vi.spyOn(privacyApi, 'getPolicy').mockResolvedValue(policy)
  vi.spyOn(privacyApi, 'acceptPolicy').mockResolvedValue(undefined)
  vi.spyOn(privacyApi, 'exportUserData').mockResolvedValue({ user: 'ava', conversations: [] })
  vi.spyOn(privacyApi, 'eraseUserData').mockResolvedValue({ conversations_deleted: 2, feedback_deleted: 1 })
  vi.spyOn(privacyApi, 'deleteUserAccount').mockResolvedValue(undefined)

  vi.spyOn(adminApi, 'listConnections').mockResolvedValue([connection])
  vi.spyOn(adminApi, 'listUsers').mockResolvedValue([account])
  vi.spyOn(adminApi, 'listFeedback').mockResolvedValue([feedback])
  vi.spyOn(adminApi, 'getFeedbackStats').mockResolvedValue({
    total: 1,
    helpful: 1,
    not_helpful: 0,
    satisfaction_percent: 100,
  })
  vi.spyOn(adminApi, 'listAudit').mockResolvedValue([])
  vi.spyOn(adminApi, 'saveConnection').mockResolvedValue(connection)
  vi.spyOn(adminApi, 'testConnection').mockResolvedValue({ ok: true, message: 'Connection test succeeded.' })
  vi.spyOn(adminApi, 'deleteConnection').mockResolvedValue(undefined)
  vi.spyOn(adminApi, 'updateUser').mockResolvedValue(account)

  vi.spyOn(ingestionApi, 'getIngestionOptions').mockResolvedValue(ingestionOptions)
  vi.spyOn(ingestionApi, 'listPipelines').mockResolvedValue([])
  vi.spyOn(ingestionApi, 'createPipeline').mockResolvedValue({ id: pipeline.id, status: 'queued' })
  vi.spyOn(ingestionApi, 'getPipeline').mockResolvedValue(pipeline)
  vi.spyOn(ingestionApi, 'getPipelineChunks').mockResolvedValue([chunk])
})

describe('authentication and application shell', () => {
  it('shows bootstrap state, falls back to login, and signs in', async () => {
    let rejectLookup!: (reason: Error) => void
    vi.mocked(authApi.getCurrentUser).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectLookup = reject
      }),
    )
    render(<App />)
    expect(screen.getByText('Opening your workspace...')).toBeInTheDocument()
    await act(async () => rejectLookup(new Error('No session')))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    await user().type(screen.getByLabelText('Username'), 'ava')
    await user().type(screen.getByLabelText('Password'), 'password')
    await user().click(screen.getByRole('button', { name: 'Sign in' }))
    expect(authApi.signIn).toHaveBeenCalledWith('ava', 'password')
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('creates account only after matching password and policy acceptance', async () => {
    const onAuthenticated = vi.fn()
    const onOpenPolicy = vi.fn()
    render(<AccountForm onAuthenticated={onAuthenticated} onOpenPolicy={onOpenPolicy} />)
    await user().click(screen.getByRole('tab', { name: 'Create account' }))
    await user().type(screen.getByLabelText('Username'), 'new-user')
    await user().type(screen.getByLabelText('Password'), 'long-password-1')
    await user().type(screen.getByLabelText('Confirm password'), 'different-password')
    await user().click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    await user().clear(screen.getByLabelText('Confirm password'))
    await user().type(screen.getByLabelText('Confirm password'), 'long-password-1')
    await user().click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Accept the data policy to create an account.')
    await user().click(screen.getByRole('button', { name: 'data policy' }))
    expect(onOpenPolicy).toHaveBeenCalledOnce()
    await user().click(screen.getByRole('checkbox'))
    await user().click(screen.getByRole('button', { name: /premium/ }))
    await user().click(screen.getByRole('button', { name: 'Create account' }))
    expect(authApi.register).toHaveBeenCalledWith('new-user', 'long-password-1', 'premium')
    expect(onAuthenticated).toHaveBeenCalledWith(standardUser)
  })

  it('accepts blocking policy, navigates for standard user, and signs out despite request failure', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...standardUser, policy_accepted: false })
    vi.mocked(authApi.signOut).mockRejectedValue(new Error('network unavailable'))
    render(<App />)
    expect(await screen.findByRole('dialog', { name: 'Data policy' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Accept policy' }))
    await user().click(screen.getByRole('button', { name: 'Documents' }))
    expect(await screen.findByRole('heading', { name: 'Support documents' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
    await user().click(screen.getByRole('link', { name: /fieldnote/ }))
    expect(await screen.findByRole('heading', { name: 'How can we help?' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Privacy' }))
    expect(await screen.findByRole('heading', { name: 'Privacy & data' })).toBeInTheDocument()
    const createObjectURL = vi.fn(() => 'blob:test')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await user().click(screen.getByRole('button', { name: /Export data/ }))
    expect(await screen.findByText('Your export has been prepared.')).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
    await user().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(authApi.signOut).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('shows admin navigation and closes policy overlay without changing consent', async () => {
    const onSignOut = vi.fn()
    const onDeleted = vi.fn()
    const onPolicyAccepted = vi.fn()
    render(
      <AppShell
        user={{ ...adminUser, policy_accepted: false }}
        onSignOut={onSignOut}
        onDeleted={onDeleted}
        onPolicyAccepted={onPolicyAccepted}
      />,
    )
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Data policy' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Admin' }))
    expect(await screen.findByRole('heading', { name: 'Admin console' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onPolicyAccepted).not.toHaveBeenCalled()
  })
})

describe('chat and document workflows', () => {
  it('loads a conversation, sends question, rates answer, opens source and deletes session', async () => {
    vi.mocked(chatApi.listSessions).mockResolvedValue([session])
    vi.mocked(chatApi.getSession).mockResolvedValue(session)
    const onBrowseDocuments = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ChatView onBrowseDocuments={onBrowseDocuments} />)
    expect(await screen.findByRole('heading', { name: 'VPN help' })).toBeInTheDocument()
    await user().type(screen.getByRole('textbox', { name: 'Your question' }), 'How do I reconnect?')
    await user().click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalledWith(session.id, 'How do I reconnect?'))
    await user().click(screen.getAllByRole('button', { name: 'Helpful' })[1])
    expect(await screen.findByText('Thanks for rating this answer.')).toBeInTheDocument()
    await user().click(screen.getAllByRole('button', { name: 'Not helpful' })[1])
    await user().click(screen.getByLabelText('Incorrect'))
    await user().type(screen.getByLabelText('Additional context'), 'More detail')
    await user().click(screen.getByRole('button', { name: 'Submit feedback' }))
    await waitFor(() =>
      expect(chatApi.submitFeedback).toHaveBeenCalledWith(
        session.id,
        sentMessage.id,
        'down',
        ['incorrect'],
        'More detail',
      ),
    )
    await user().click(screen.getAllByRole('button', { name: /VPN guide/ })[1])
    expect(await screen.findByRole('dialog', { name: 'VPN guide' })).toBeInTheDocument()
    expect(documentApi.getDocument).toHaveBeenCalledWith(document.id)
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    await user().click(screen.getByRole('button', { name: 'Delete VPN help' }))
    expect(confirm).toHaveBeenCalledWith('Delete this conversation and its feedback?')
    expect(chatApi.deleteSession).toHaveBeenCalledWith(session.id)
    await user().click(screen.getByRole('button', { name: 'Browse knowledge base' }))
    expect(onBrowseDocuments).toHaveBeenCalledOnce()
  })

  it('reports load, send, source, feedback and session-create errors without losing question', async () => {
    vi.mocked(chatApi.listSessions).mockRejectedValueOnce(new Error('History unavailable'))
    vi.mocked(privacyApi.getPolicy).mockRejectedValueOnce(new Error('Policy offline'))
    vi.mocked(chatApi.createSession).mockRejectedValueOnce(new Error('Cannot create'))
    render(<ChatView onBrowseDocuments={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable')
    await user().click(screen.getAllByRole('button', { name: 'New conversation' })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot create')
    vi.mocked(chatApi.createSession).mockResolvedValueOnce({ ...session, messages: [] })
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(new Error('Answer failed'))
    await user().type(screen.getByRole('textbox', { name: 'Your question' }), 'Try again')
    await user().click(screen.getByRole('button', { name: 'Send question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Answer failed')
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('Try again')
  })

  it('loads document filters, opens and closes reader, and reports list/detail errors', async () => {
    vi.mocked(documentApi.listDocuments).mockResolvedValue([document])
    render(<DocumentsView />)
    expect(await screen.findByRole('button', { name: /VPN guide/ })).toBeInTheDocument()
    await user().type(screen.getByRole('textbox', { name: 'Search documents' }), 'password')
    await waitFor(() =>
      expect(documentApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'password' })),
    )
    await user().click(screen.getByRole('button', { name: /VPN guide/ }))
    expect(await screen.findByRole('heading', { name: 'VPN guide' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    expect(screen.getByText('Choose a document')).toBeInTheDocument()
    vi.mocked(documentApi.getDocument).mockRejectedValueOnce(new Error('Document unavailable'))
    await user().click(screen.getByRole('button', { name: /VPN guide/ }))
    expect(await screen.findByText('Document unavailable')).toBeInTheDocument()
  })
})

describe('privacy and administration workflows', () => {
  it('confirms data erasure and account deletion, and handles cancellation/errors', async () => {
    const onDeleted = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PrivacyView onDeleted={onDeleted} />)
    expect(await screen.findByText('2.1')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Delete conversations/ }))
    expect(privacyApi.eraseUserData).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await user().click(screen.getByRole('button', { name: /Delete conversations/ }))
    expect(await screen.findByText('Deleted 2 conversations and 1 feedback records.')).toBeInTheDocument()
    await user().type(screen.getByLabelText('Confirm password'), 'wrong-password')
    vi.mocked(privacyApi.deleteUserAccount).mockRejectedValueOnce(new Error('Password rejected'))
    await user().click(screen.getByRole('button', { name: /Delete account permanently/ }))
    expect(await screen.findByText('Password rejected')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Open full policy/ }))
    expect(screen.getByRole('dialog', { name: 'Current data policy' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close policy' }))
    await user().click(screen.getByRole('button', { name: /Delete account permanently/ }))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
  })

  it('loads admin tabs, saves a connection, edits a user, filters feedback and audit', async () => {
    render(<AdminView />)
    expect(await screen.findByRole('heading', { name: 'Connections' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Test Standard' }))
    expect(await screen.findByText('Connection test succeeded.')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Add connection' }))
    await user().type(screen.getByLabelText('Name'), 'New route')
    await user().click(screen.getByRole('button', { name: 'Save connection' }))
    await waitFor(() => expect(adminApi.saveConnection).toHaveBeenCalled())
    expect(await screen.findByText('Connection created.')).toBeInTheDocument()

    await user().click(screen.getByRole('tab', { name: 'Users' }))
    expect(await screen.findByText('casey')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Edit casey' }))
    await user().selectOptions(screen.getByLabelText('Plan for casey'), 'premium')
    await user().click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(adminApi.updateUser).toHaveBeenCalledWith('account-1', { plan: 'premium' }))

    await user().click(screen.getByRole('tab', { name: 'Chat feedback' }))
    expect(await screen.findByText('VPN broken')).toBeInTheDocument()
    await user().selectOptions(screen.getByRole('combobox'), 'up')
    await waitFor(() => expect(adminApi.listFeedback).toHaveBeenLastCalledWith('up'))

    await user().click(screen.getByRole('tab', { name: 'Audit log' }))
    await user().type(screen.getByLabelText('Event'), 'auth.login')
    await user().click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() =>
      expect(adminApi.listAudit).toHaveBeenLastCalledWith({ event: 'auth.login', outcome: '', username: '' }),
    )
  })

  it('handles admin request and connection deletion failures safely', async () => {
    vi.mocked(adminApi.testConnection).mockRejectedValueOnce(new Error('Connection test failed'))
    vi.mocked(adminApi.listConnections).mockResolvedValue([{ ...connection, plans: [] }])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AdminView />)
    await screen.findByRole('heading', { name: 'Connections' })
    await user().click(screen.getByRole('button', { name: 'Test Standard' }))
    expect(await screen.findByText('Connection test failed')).toBeInTheDocument()
    vi.mocked(adminApi.deleteConnection).mockRejectedValueOnce(new Error('Cannot delete'))
    await user().click(screen.getByRole('button', { name: 'Delete Standard' }))
    expect(confirm).toHaveBeenCalledWith('Delete Standard?')
    expect(await screen.findByText('Cannot delete')).toBeInTheDocument()
  })
})

describe('ingestion workflows', () => {
  it('submits an uploaded document and routes to its pipeline', async () => {
    const onOpenPipeline = vi.fn()
    const { container } = render(<IngestionView onOpenPipeline={onOpenPipeline} />)
    await screen.findByText('Model A')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user().upload(input, new File(['support runbook'], 'guide.txt', { type: 'text/plain' }))
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    await waitFor(() => expect(ingestionApi.createPipeline).toHaveBeenCalled())
    expect(await screen.findByText(pipeline.id)).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'View Pipeline' }))
    expect(onOpenPipeline).toHaveBeenCalledWith(pipeline.id)
  })

  it('renders completed pipeline details, chunk preview, errors and back navigation', async () => {
    const onBack = vi.fn()
    render(<IngestionPipelineView pipelineId={pipeline.id} onBack={onBack} />)
    expect(await screen.findByRole('heading', { name: 'runbook.txt' })).toBeInTheDocument()
    expect(await screen.findByText('Chunk #1')).toBeInTheDocument()
    expect(ingestionApi.getPipelineChunks).toHaveBeenCalledWith(pipeline.id)
    await user().click(screen.getByRole('tab', { name: /Extracted Text/ }))
    expect(screen.getByText('Redacted source text')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Back to Ingestion' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('polls queued pipeline, stops at failed state, and displays retryable fetch error', async () => {
    vi.useFakeTimers()
    const pending = { ...pipeline, status: 'running' as const, error: 'Provider failed' }
    vi.mocked(ingestionApi.getPipeline)
      .mockResolvedValueOnce(pending)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ...pipeline, status: 'failed', error: 'Pipeline stopped' })
    const onBack = vi.fn()
    render(<IngestionPipelineView pipelineId={pipeline.id} onBack={onBack} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText(/Pipeline error: Provider failed/)).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText('Network error')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText(/Pipeline error: Pipeline stopped/)).toBeInTheDocument()
    expect(ingestionApi.getPipelineChunks).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
