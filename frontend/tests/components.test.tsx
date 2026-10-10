import { createRef } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Markdown } from '../src/components/Markdown'
import { ConversationRail } from '../src/components/chat/ConversationRail'
import { ChatTranscript } from '../src/components/chat/ChatTranscript'
import { MessageComposer } from '../src/components/chat/MessageComposer'
import { FeedbackDialog } from '../src/components/chat/FeedbackDialog'
import { SourceDialog } from '../src/components/chat/SourceDialog'
import { DocumentList } from '../src/components/documents/DocumentList'
import { DocumentReader } from '../src/components/documents/DocumentReader'
import { PolicySummary } from '../src/components/privacy/PolicySummary'
import { PrivacyActions } from '../src/components/privacy/PrivacyActions'
import { AuditSection } from '../src/components/admin/AuditSection'
import { ConnectionDialog } from '../src/components/admin/ConnectionDialog'
import { ConnectionsSection } from '../src/components/admin/ConnectionsSection'
import { FeedbackSection } from '../src/components/admin/FeedbackSection'
import { UsersSection } from '../src/components/admin/UsersSection'
import { blankConnection, planLabels } from '../src/components/admin/types'
import { IngestionForm } from '../src/components/ingestion/IngestionForm'
import { PipelineDetails } from '../src/components/ingestion/PipelineDetails'
import { PipelineHistory } from '../src/components/ingestion/PipelineHistory'
import { PipelineStages } from '../src/components/ingestion/PipelineStages'
import { createPipelineExportPayload } from '../src/components/ingestion/pipelinePayload'
import type { User } from '../src/types/account'
import type { Connection } from '../src/types/connections'
import type { AdminUser, AuditEntry, Feedback as AdminFeedback, FeedbackStats } from '../src/types/admin'
import type { ChatSession, Message } from '../src/types/chat'
import type { DocumentItem } from '../src/types/documents'
import type { Policy } from '../src/types/privacy'
import type { ChunkPreview, IngestionOptions, IngestionPipeline, PipelineSummary } from '../src/types/ingestion'

const user = userEvent.setup

const document: DocumentItem = {
  id: 'doc-1',
  title: 'VPN troubleshooting',
  category: 'Network',
  tags: ['vpn', 'access'],
  markdown: '# Reconnect\n\nRestart **the client**.',
}

const message: Message = {
  id: 'message-1',
  question: 'VPN fails',
  answer: 'Restart the client.',
  status: 'ok',
  sources: [
    { document_id: document.id, document_title: document.title, section: 'Reconnect', score: 1, excerpt: 'Restart.' },
  ],
  model: { name: 'Fieldnote', provider: 'mock', model: 'simulator' },
  latency_ms: 12,
  redacted: true,
  created_at: '2026-01-01T00:00:00Z',
}

const policy: Policy = {
  version: '2.1',
  title: 'Data policy',
  retention: { conversations: 90, feedback: 30, audit: 365 },
  sections: [{ heading: 'Retention', text: 'Data expires automatically.' }],
}

const connection: Connection = {
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

const adminUser: AdminUser = {
  id: 'user-1',
  username: 'ava',
  role: 'user',
  plan: 'standard',
  created_at: '2026-01-01T00:00:00Z',
}

const options: IngestionOptions = {
  models: [{ id: 'model-a', label: 'Model A', dimensions: 384, target: 'Cloudflare' }],
  separators: [{ value: '\n', label: 'Lines' }],
  chunk_size: { min: 100, max: 2000, default: 600 },
  chunk_overlap: { min: 0, default: 40 },
}

const stageInfo = { status: 'done' as const, latency_ms: 10 }
const pipeline: IngestionPipeline = {
  id: 'pipeline-1',
  filename: 'runbook.txt',
  file_size: 1024,
  status: 'completed',
  options: { chunk_size: 500, chunk_overlap: 50, separator: '\n', embedding_model: 'model-a' },
  stages: { file_parsing: stageInfo, chunking: stageInfo, embedding: stageInfo, database_ready: stageInfo },
  chunk_count: 1,
  extracted_text: 'Sanitized runbook text',
  error: null,
  created_at: '2026-01-01T00:00:00Z',
  expires_at: null,
}
const chunk: ChunkPreview = { index: 0, content: 'Chunk text', model: 'model-a', dimensions: 384 }

describe('shared and chat components', () => {
  it('renders Markdown with GFM formatting', () => {
    render(<Markdown>{'~~old~~ **new**'}</Markdown>)
    expect(screen.getByText('old').tagName).toBe('DEL')
    expect(screen.getByText('new').tagName).toBe('STRONG')
  })

  it('shows conversation loading, empty, and populated states with actions', async () => {
    const onCreate = vi.fn()
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    const onBrowse = vi.fn()
    const props = { sessions: [], loading: true, onCreate, onSelect, onDelete, onBrowseDocuments: onBrowse }
    const { rerender } = render(<ConversationRail {...props} />)
    expect(screen.getByText('Loading history...')).toBeInTheDocument()
    rerender(<ConversationRail {...props} loading={false} />)
    expect(screen.getByText(/recent conversations/)).toBeInTheDocument()
    const session: ChatSession = {
      id: 'session-1',
      title: '',
      created_at: '',
      updated_at: '2026-01-01T00:00:00Z',
    }
    rerender(<ConversationRail {...props} loading={false} sessions={[session]} activeSessionId={session.id} />)
    expect(screen.getAllByText('New conversation')).toHaveLength(2)
    await user().click(screen.getAllByRole('button', { name: 'New conversation' })[0])
    await user().click(screen.getByRole('button', { name: 'Browse knowledge base' }))
    await user().click(screen.getByRole('button', { name: /^Delete/ }))
    await user().click(screen.getAllByRole('button', { name: 'New conversation' })[1])
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(onBrowse).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(session.id)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders suggestions and complete answer states with citations and ratings', async () => {
    const onSendSuggestion = vi.fn()
    const onBrowse = vi.fn()
    const onOpenSource = vi.fn()
    const onRate = vi.fn()
    const endRef = createRef<HTMLDivElement>()
    const { rerender } = render(
      <ChatTranscript
        active={null}
        sending
        endRef={endRef}
        onSendSuggestion={onSendSuggestion}
        onBrowseDocuments={onBrowse}
        onOpenSource={onOpenSource}
        onRate={onRate}
      />,
    )
    expect(screen.getByText('Searching runbooks and preparing an answer')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /My VPN is stuck/ }))
    await user().click(screen.getByRole('button', { name: /Explore all support documents/ }))
    expect(onSendSuggestion).toHaveBeenCalledOnce()
    expect(onBrowse).toHaveBeenCalledOnce()
    rerender(
      <ChatTranscript
        active={{
          id: 's',
          title: 'Help',
          created_at: '',
          updated_at: '',
          messages: [message, { ...message, id: 'm2', status: 'error', redacted: false, sources: [] }],
        }}
        sending={false}
        endRef={endRef}
        onSendSuggestion={onSendSuggestion}
        onBrowseDocuments={onBrowse}
        onOpenSource={onOpenSource}
        onRate={onRate}
      />,
    )
    expect(screen.getByText('Sensitive data was redacted before processing')).toBeInTheDocument()
    expect(screen.getByText('The configured model could not complete this answer.')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /VPN troubleshooting/ }))
    const firstAnswer = screen.getAllByRole('article')[0]
    await user().click(within(firstAnswer).getByRole('button', { name: 'Helpful' }))
    await user().click(within(firstAnswer).getByRole('button', { name: 'Not helpful' }))
    expect(onOpenSource).toHaveBeenCalledWith(message.sources[0])
    expect(onRate).toHaveBeenNthCalledWith(1, message, 'up')
    expect(onRate).toHaveBeenNthCalledWith(2, message, 'down')
  })

  it('sends with Enter but preserves Shift+Enter and dismisses composer messages', async () => {
    const onSend = vi.fn()
    const onQuestionChange = vi.fn()
    const onDismissError = vi.fn()
    const onDismissNotice = vi.fn()
    const onOpenPolicy = vi.fn()
    const props = {
      question: '  help  ',
      sending: false,
      error: 'Failed',
      notice: 'Saved',
      retentionDays: 45,
      inputRef: createRef<HTMLTextAreaElement>(),
      onQuestionChange,
      onSend,
      onDismissError,
      onDismissNotice,
      onOpenPolicy,
    }
    render(<MessageComposer {...props} />)
    const input = screen.getByRole('textbox', { name: 'Your question' })
    expect(screen.getByRole('button', { name: 'Send question' })).toBeEnabled()
    expect(screen.getByText(/retained for 45 days/)).toBeInTheDocument()
    await user().click(screen.getAllByRole('button', { name: 'Dismiss' })[0])
    await user().click(screen.getAllByRole('button', { name: 'Dismiss' })[1])
    await user().click(screen.getByRole('button', { name: 'Data policy' }))
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledOnce()
    expect(onDismissError).toHaveBeenCalledOnce()
    expect(onDismissNotice).toHaveBeenCalledOnce()
    expect(onOpenPolicy).toHaveBeenCalledOnce()
    const form = input.closest('form')!
    fireEvent.submit(form)
    expect(onSend).toHaveBeenCalledTimes(2)
  })

  it('selects and removes feedback categories, submits comment, and handles both close paths', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const onOpenPolicy = vi.fn()
    render(<FeedbackDialog retentionDays={30} onClose={onClose} onOpenPolicy={onOpenPolicy} onSubmit={onSubmit} />)
    const incorrect = screen.getByLabelText('Incorrect')
    await user().click(incorrect)
    await user().click(incorrect)
    await user().click(screen.getByLabelText('Hard to follow'))
    await user().type(screen.getByLabelText('Additional context'), 'Needs more detail')
    await user().click(screen.getByRole('button', { name: 'Data policy' }))
    await user().click(screen.getByRole('button', { name: 'Submit feedback' }))
    expect(onSubmit).toHaveBeenCalledWith(['unclear'], 'Needs more detail')
    expect(onOpenPolicy).toHaveBeenCalledOnce()
    await user().click(screen.getByRole('button', { name: 'Close feedback' }))
    fireEvent.mouseDown(screen.getByRole('presentation'), { target: screen.getByRole('presentation') })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes source dialog from close control or backdrop', async () => {
    const onClose = vi.fn()
    const { container } = render(<SourceDialog source={document} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: document.title })).toBeInTheDocument()
    expect(
      screen.getByText((_text, element) => element?.tagName === 'P' && element.textContent === 'Restart the client.'),
    ).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    fireEvent.mouseDown(container.querySelector('.modal-scrim')!, { target: container.querySelector('.modal-scrim') })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('documents and privacy components', () => {
  it('filters document list controls, opens rows, toggles tags, and renders empty/error states', async () => {
    const onQueryChange = vi.fn()
    const onCategoryChange = vi.fn()
    const onTagChange = vi.fn()
    const onOpen = vi.fn()
    const props = {
      documents: [document],
      selectedId: document.id,
      query: 'vpn',
      category: 'Network',
      tag: 'vpn',
      categories: ['All categories', 'Network'],
      error: '',
      onQueryChange,
      onCategoryChange,
      onTagChange,
      onOpen,
    }
    const { rerender } = render(<DocumentList {...props} />)
    await user().click(screen.getByRole('button', { name: 'Clear search' }))
    await user().selectOptions(screen.getByRole('combobox', { name: 'Filter by category' }), 'All categories')
    await user().click(screen.getByRole('button', { name: /VPN troubleshooting/ }))
    await user().click(screen.getByRole('button', { name: 'vpn' }))
    expect(onQueryChange).toHaveBeenCalledWith('')
    expect(onCategoryChange).toHaveBeenCalledWith('All categories')
    expect(onOpen).toHaveBeenCalledWith(document.id)
    expect(onTagChange).toHaveBeenCalledWith('')
    rerender(<DocumentList {...props} documents={[]} query="" tag="" error="Could not load" />)
    expect(screen.getByText('Could not load')).toBeInTheDocument()
    expect(screen.queryByText('No documents match')).not.toBeInTheDocument()
    rerender(<DocumentList {...props} documents={[]} query="" tag="" error="" />)
    expect(screen.getByText('No documents match')).toBeInTheDocument()
  })

  it('renders empty and selected document reader states', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<DocumentReader document={null} onClose={onClose} />)
    expect(screen.getByText('Choose a document')).toBeInTheDocument()
    rerender(<DocumentReader document={document} onClose={onClose} />)
    expect(screen.getByText(document.title)).toBeInTheDocument()
    expect(screen.getByText('vpn')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders policy sections and empty policy, and opens full policy', async () => {
    const onOpenFullPolicy = vi.fn()
    const { rerender } = render(<PolicySummary policy={null} onOpenFullPolicy={onOpenFullPolicy} />)
    expect(screen.getByRole('heading', { name: 'Data policy' })).toBeInTheDocument()
    rerender(<PolicySummary policy={policy} onOpenFullPolicy={onOpenFullPolicy} />)
    expect(screen.getByText('Retention')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Open full policy/ }))
    expect(onOpenFullPolicy).toHaveBeenCalledOnce()
  })

  it('exposes privacy export, erasure, and password confirmation actions', async () => {
    const onExport = vi.fn()
    const onErase = vi.fn()
    const onPasswordChange = vi.fn()
    const onDeleteAccount = vi.fn((event) => event.preventDefault())
    const view = render(
      <PrivacyActions
        busy={false}
        password=""
        onPasswordChange={onPasswordChange}
        onExport={onExport}
        onErase={onErase}
        onDeleteAccount={onDeleteAccount}
      />,
    )
    expect(screen.getByRole('button', { name: /Delete account permanently/ })).toBeDisabled()
    await user().click(screen.getByRole('button', { name: /Export data/ }))
    await user().click(screen.getByRole('button', { name: /Delete conversations/ }))
    await user().type(screen.getByLabelText('Confirm password'), 'password')
    expect(onPasswordChange).toHaveBeenCalled()
    view.rerender(
      <PrivacyActions
        busy={false}
        password="password"
        onPasswordChange={onPasswordChange}
        onExport={onExport}
        onErase={onErase}
        onDeleteAccount={onDeleteAccount}
      />,
    )
    expect(screen.getByRole('button', { name: /Delete account permanently/ })).toBeEnabled()
    fireEvent.submit(screen.getByRole('button', { name: /Delete account permanently/ }).closest('form')!)
    expect(onExport).toHaveBeenCalledOnce()
    expect(onErase).toHaveBeenCalledOnce()
    expect(onDeleteAccount).toHaveBeenCalledOnce()
  })
})

describe('admin components', () => {
  it('renders connections, plan warnings, API key state, and actions', async () => {
    const onAdd = vi.fn()
    const onEdit = vi.fn()
    const onTest = vi.fn()
    const onDelete = vi.fn()
    const simulator: Connection = {
      ...connection,
      id: 'sim',
      name: 'Simulator',
      provider: 'mock',
      has_api_key: false,
      plans: [],
    }
    render(
      <ConnectionsSection
        connections={[connection, simulator]}
        missingPlans={[{ id: 'basic', label: 'Basic' }]}
        onAdd={onAdd}
        onEdit={onEdit}
        onTest={onTest}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText(/Basic has no model assigned/)).toBeInTheDocument()
    expect(screen.getByText('sk-...1234')).toBeInTheDocument()
    expect(screen.getByText('No key')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Add connection' }))
    await user().click(screen.getByRole('button', { name: 'Test Standard model' }))
    await user().click(screen.getByRole('button', { name: 'Edit Standard model' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onTest).toHaveBeenCalledWith(connection)
    expect(onEdit).toHaveBeenCalledWith(connection)
    expect(screen.getByRole('button', { name: 'Delete Standard model' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete Simulator' })).toBeEnabled()
    await user().click(screen.getByRole('button', { name: 'Delete Simulator' }))
    expect(onDelete).toHaveBeenCalledWith(simulator)
    const { rerender } = render(
      <ConnectionsSection
        connections={[]}
        missingPlans={[]}
        onAdd={onAdd}
        onEdit={onEdit}
        onTest={onTest}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('No model connections configured.')).toBeInTheDocument()
    rerender(
      <ConnectionsSection
        connections={[connection]}
        missingPlans={planLabels}
        onAdd={onAdd}
        onEdit={onEdit}
        onTest={onTest}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText(/Basic, Standard, Premium have no model assigned/)).toBeInTheDocument()
  })

  it('covers provider-specific connection fields and plan selection', async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    const onSubmit = vi.fn((event) => event.preventDefault())
    const { rerender } = render(
      <ConnectionDialog
        form={blankConnection}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText(/built-in extractive simulator/)).toBeInTheDocument()
    await user().selectOptions(screen.getByLabelText('Provider'), 'openai')
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'openai' }}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText(/OpenAI, Mistral/)).toBeInTheDocument()
    expect(screen.getByLabelText('Base URL')).toHaveAttribute('placeholder', 'Leave empty for OpenAI')
    await user().selectOptions(screen.getByLabelText('Provider'), 'azure_openai')
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'azure_openai' }}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByLabelText('API version')).toHaveAttribute('placeholder', '2024-10-21')
    expect(screen.getByText(/deployment name/)).toBeInTheDocument()
    await user().selectOptions(screen.getByLabelText('Provider'), 'anthropic')
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'anthropic' }}
        editing={null}
        connections={[]}
        busy={false}
        error=""
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByLabelText('API version')).toHaveAttribute('placeholder', '2023-06-01')
    expect(screen.getByText(/Anthropic Messages API/)).toBeInTheDocument()
    await user().click(screen.getByLabelText('Basic'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ plans: expect.not.arrayContaining(['basic']) }))
    rerender(
      <ConnectionDialog
        form={{ ...blankConnection, provider: 'openai', api_key: '', plans: ['standard'] }}
        editing={connection.id}
        connections={[connection]}
        busy
        error="Save failed"
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Edit connection' })).toBeInTheDocument()
    expect(screen.getByLabelText('API key')).toHaveAttribute('placeholder', 'Leave empty to keep sk-...1234')
    await user().click(screen.getByLabelText('Remove the stored API key'))
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'new-secret' } })
    await user().click(screen.getByRole('button', { name: 'Close form' }))
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ provider: 'openai' })
    expect(onChange).toHaveBeenCalledWith({ api_key: 'new-secret', remove_api_key: false })
  })

  it('renders staged user edits, model assignment and busy states', async () => {
    const onStartEdit = vi.fn()
    const onCancelEdit = vi.fn()
    const onStageEdit = vi.fn()
    const onConfirmEdit = vi.fn()
    const rootUser: AdminUser = { ...adminUser, id: 'admin', username: 'root', role: 'admin', plan: 'basic' }
    const props = {
      users: [adminUser, rootUser],
      connections: [connection],
      userEdits: {},
      savingUsers: new Set<string>(),
      onStartEdit,
      onCancelEdit,
      onStageEdit,
      onConfirmEdit,
    }
    const { rerender } = render(<UsersSection {...props} />)
    expect(screen.getByText('No model assigned')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Edit ava' }))
    expect(onStartEdit).toHaveBeenCalledWith(adminUser)
    rerender(<UsersSection {...props} userEdits={{ [adminUser.id]: { role: 'admin', plan: 'premium' } }} />)
    await user().selectOptions(screen.getByLabelText('Role for ava'), 'user')
    await user().selectOptions(screen.getByLabelText('Plan for ava'), 'basic')
    await user().click(screen.getByRole('button', { name: 'Confirm' }))
    await user().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onStageEdit).toHaveBeenCalledTimes(2)
    expect(onConfirmEdit).toHaveBeenCalledWith(adminUser)
    expect(onCancelEdit).toHaveBeenCalledWith(adminUser)
    rerender(
      <UsersSection
        {...props}
        userEdits={{ [adminUser.id]: { role: 'user', plan: 'standard' } }}
        savingUsers={new Set([adminUser.id])}
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
  })

  it('renders feedback statistics, comments, categories, filters, and empty state', async () => {
    const stats: FeedbackStats = { total: 2, helpful: 1, not_helpful: 1, satisfaction_percent: 50 }
    const entry: AdminFeedback = {
      session_id: 's',
      message_id: 'm',
      username: 'ava',
      rating: 'down',
      categories: ['irrelevant_sources'],
      comment: 'Add a source',
      question: 'Question',
      answer: 'Answer',
      model: { model: 'assistant' },
      created_at: '2026-01-01',
    }
    const onRatingChange = vi.fn()
    const { rerender } = render(
      <FeedbackSection feedback={[entry]} stats={stats} rating="" onRatingChange={onRatingChange} />,
    )
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('irrelevant sources')).toBeInTheDocument()
    expect(screen.getByText('Add a source')).toBeInTheDocument()
    await user().selectOptions(screen.getByRole('combobox'), 'down')
    expect(onRatingChange).toHaveBeenCalledWith('down')
    rerender(<FeedbackSection feedback={[]} stats={stats} rating="down" onRatingChange={onRatingChange} />)
    expect(screen.getByText('No feedback matches this filter.')).toBeInTheDocument()
  })

  it('submits audit filters and renders optional event details', async () => {
    const entry: AuditEntry = {
      timestamp: '2026-01-01',
      event: 'auth.login',
      outcome: 'success',
      actor: { username: 'ava' },
      details: { method: 'password' },
      request_id: 'req-1',
    }
    const onFiltersChange = vi.fn()
    const onSubmit = vi.fn((event) => event.preventDefault())
    const filters = { event: '', outcome: '', username: '' }
    const { rerender } = render(
      <AuditSection
        audit={[
          entry,
          { ...entry, event: 'privacy.export', actor: undefined, details: undefined, request_id: undefined },
        ]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onSubmit={onSubmit}
      />,
    )
    await user().type(screen.getByLabelText('Event'), 'auth.login')
    await user().selectOptions(screen.getByLabelText('Outcome'), 'failure')
    await user().type(screen.getByLabelText('Username'), 'ava')
    await user().click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(onFiltersChange).toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('method: password')).toBeInTheDocument()
    rerender(<AuditSection audit={[]} filters={filters} onFiltersChange={onFiltersChange} onSubmit={onSubmit} />)
    expect(screen.getByText('No audit events match these filters.')).toBeInTheDocument()
  })
})

describe('ingestion components', () => {
  it('validates upload selection, drag state, options, and submits file settings', async () => {
    const onError = vi.fn()
    const onSelectionChange = vi.fn()
    const onSubmit = vi.fn()
    const { container, rerender } = render(
      <IngestionForm
        options={null}
        submitting={false}
        error=""
        onError={onError}
        onSelectionChange={onSelectionChange}
        onSubmit={onSubmit}
      />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['bad'], 'image.png', { type: 'image/png' })] } })
    expect(onError).toHaveBeenCalledWith('Unsupported file type. Only .txt and .pdf files are accepted.')
    rerender(
      <IngestionForm
        options={options}
        submitting={false}
        error="Visible error"
        onError={onError}
        onSelectionChange={onSelectionChange}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText('Visible error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeInTheDocument()
    const zeroFile = new File([], 'empty.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [zeroFile] } })
    expect(onError).toHaveBeenCalledWith('Uploaded file cannot be empty.')
    const largeFile = new File([new Uint8Array(512_001)], 'large.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [largeFile] } })
    expect(onError).toHaveBeenCalledWith('File exceeds maximum allowed size of 500 KB (512,000 bytes).')
    const validFile = new File(['runbook'], 'guide.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [validFile] } })
    expect(screen.getByText('guide.txt')).toBeInTheDocument()
    expect(screen.getByText('Cloudflare')).toBeInTheDocument()
    await user().clear(screen.getAllByRole('spinbutton')[0])
    await user().type(screen.getAllByRole('spinbutton')[0], '700')
    await user().selectOptions(screen.getAllByRole('combobox')[0], '\n')
    await user().selectOptions(screen.getAllByRole('combobox')[1], 'model-a')
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    expect(onSubmit).toHaveBeenCalledWith(
      validFile,
      expect.objectContaining({ chunkSize: 700, embeddingModel: 'model-a' }),
    )
    expect(onSelectionChange).toHaveBeenCalled()
    const dropzone = container.querySelector('.upload-dropzone')!
    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('dragging')
    fireEvent.dragLeave(dropzone)
    fireEvent.drop(dropzone, { dataTransfer: { files: [validFile] } })
    expect(dropzone).not.toHaveClass('dragging')
  })

  it('shows pipeline history loading, errors, empty, and populated states', async () => {
    const onRefresh = vi.fn()
    const onDismissError = vi.fn()
    const onOpen = vi.fn()
    const summary: PipelineSummary = {
      id: pipeline.id,
      filename: pipeline.filename,
      file_size: pipeline.file_size,
      status: pipeline.status,
      options: pipeline.options,
      chunk_count: 1,
      error: null,
      created_at: pipeline.created_at,
      expires_at: null,
    }
    const props = { pipelines: [], loading: true, error: '', onRefresh, onDismissError, onOpen }
    const { rerender } = render(<PipelineHistory {...props} />)
    expect(screen.getByText('Loading ingestion history...')).toBeInTheDocument()
    rerender(<PipelineHistory {...props} loading={false} />)
    expect(screen.getByText('No ingestion pipelines yet.')).toBeInTheDocument()
    rerender(<PipelineHistory {...props} loading={false} error="History failed" />)
    expect(screen.queryByText('No ingestion pipelines yet.')).not.toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Dismiss error' }))
    rerender(<PipelineHistory {...props} loading={false} pipelines={[summary]} />)
    await user().click(screen.getByRole('button', { name: /runbook.txt/ }))
    await user().click(screen.getByRole('button', { name: 'Refresh ingestion history' }))
    expect(onOpen).toHaveBeenCalledWith(summary.id)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onDismissError).toHaveBeenCalledOnce()
  })

  it('renders all pipeline stage statuses and idle defaults', () => {
    const { rerender } = render(<PipelineStages pipeline={null} />)
    expect(screen.getAllByText('idle')).toHaveLength(4)
    const stages = {
      file_parsing: { status: 'running' as const, latency_ms: 1 },
      chunking: { status: 'done' as const, latency_ms: 2 },
      embedding: { status: 'failed' as const, latency_ms: 3 },
      database_ready: { status: 'idle' as const, latency_ms: 0 },
    }
    rerender(<PipelineStages pipeline={{ ...pipeline, stages }} />)
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('done')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('constructs compact and full export payloads without leaking extra chunk fields', () => {
    expect(createPipelineExportPayload(null, [])).toEqual({
      id: undefined,
      filename: undefined,
      file_size: undefined,
      status: undefined,
      options: undefined,
      chunk_count: undefined,
      stages: undefined,
      chunks: [],
    })
    expect(createPipelineExportPayload(pipeline, [chunk])).toMatchObject({
      chunks: [{ index: 0, content: 'Chunk text' }],
    })
    expect(createPipelineExportPayload(pipeline, [chunk], true)).toHaveProperty('created_at', pipeline.created_at)
  })

  it('shows chunk, extracted text, and export tabs with clipboard outcomes', async () => {
    const onError = vi.fn()
    const actor = userEvent.setup()
    const { rerender } = render(<PipelineDetails pipeline={pipeline} chunks={[]} onError={onError} />)
    expect(screen.getByText('No chunks were generated from this document.')).toBeInTheDocument()
    rerender(
      <PipelineDetails
        pipeline={{ ...pipeline, status: 'running', extracted_text: '' }}
        chunks={[chunk]}
        onError={onError}
      />,
    )
    expect(screen.getByText('Chunk #1')).toBeInTheDocument()
    await actor.click(screen.getByRole('tab', { name: /Extracted Text/ }))
    expect(screen.getByText('(No text extracted yet)')).toBeInTheDocument()
    await actor.click(screen.getByRole('tab', { name: /Export Payload/ }))
    expect(screen.getByText(/"filename": "runbook.txt"/)).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Copy JSON' }))
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('clipboard unavailable'))
    await actor.click(screen.getByRole('button', { name: 'Copied!' }))
    expect(onError).toHaveBeenCalledWith('Failed to copy payload to clipboard')
    rerender(<PipelineDetails pipeline={null} chunks={[]} onError={onError} />)
    await actor.click(screen.getByRole('tab', { name: /Export Payload/ }))
    await actor.click(screen.getByRole('button', { name: 'Copied!' }))
    expect(onError).toHaveBeenCalledOnce()
  })
})
