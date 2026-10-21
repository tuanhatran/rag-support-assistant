import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as chatApi from '../api/chat'
import * as documentApi from '../api/documents'
import * as privacyApi from '../api/privacy'
import { ChatView } from './ChatView'
import { mockApis } from '../test/apiMocks'
import { viewFixtures } from '../test/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('ChatView', () => {
  it('renders streamed answer chunks before final response completes', async () => {
    vi.mocked(chatApi.listSessions).mockResolvedValue([viewFixtures.session])
    vi.mocked(chatApi.getSession).mockResolvedValue(viewFixtures.session)
    let finishStream!: () => void
    const streamGate = new Promise<void>((resolve) => {
      finishStream = resolve
    })
    vi.mocked(chatApi.sendMessage).mockImplementation(async (_sessionId, question, onChunk) => {
      onChunk?.('First chunk arrives')
      await streamGate
      onChunk?.('Complete streamed answer')
      return { ...viewFixtures.sentMessage, question, answer: 'Final persisted answer' }
    })

    render(<ChatView onBrowseDocuments={vi.fn()} />)
    await screen.findByRole('heading', { name: 'VPN help' })
    await user().type(screen.getByRole('textbox', { name: 'Your question' }), 'How do I reconnect?')
    await user().click(screen.getByRole('button', { name: 'Send question' }))

    expect(await screen.findByText('First chunk arrives')).toBeInTheDocument()
    expect(screen.queryByText('Final persisted answer')).not.toBeInTheDocument()
    finishStream()
    expect(await screen.findByText('Final persisted answer')).toBeInTheDocument()
    expect(screen.queryByText('First chunk arrives')).not.toBeInTheDocument()
  })

  it('loads a conversation, sends question, rates answer, opens source and deletes session', async () => {
    vi.mocked(chatApi.listSessions).mockResolvedValue([viewFixtures.session])
    vi.mocked(chatApi.getSession).mockResolvedValue(viewFixtures.session)
    const onBrowseDocuments = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ChatView onBrowseDocuments={onBrowseDocuments} />)
    expect(await screen.findByRole('heading', { name: 'VPN help' })).toBeInTheDocument()
    await user().type(screen.getByRole('textbox', { name: 'Your question' }), 'How do I reconnect?')
    await user().click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() =>
      expect(chatApi.sendMessage).toHaveBeenCalledWith(
        viewFixtures.session.id,
        'How do I reconnect?',
        expect.any(Function),
      ),
    )
    await user().click(screen.getAllByRole('button', { name: 'Helpful' })[1])
    expect(await screen.findByText('Thanks for rating this answer.')).toBeInTheDocument()
    await user().click(screen.getAllByRole('button', { name: 'Not helpful' })[1])
    await user().click(screen.getByLabelText('Incorrect'))
    await user().type(screen.getByLabelText('Additional context'), 'More detail')
    await user().click(screen.getByRole('button', { name: 'Submit feedback' }))
    await waitFor(() =>
      expect(chatApi.submitFeedback).toHaveBeenCalledWith(
        viewFixtures.session.id,
        viewFixtures.sentMessage.id,
        'down',
        ['incorrect'],
        'More detail',
      ),
    )
    await user().click(screen.getAllByRole('button', { name: /VPN guide/ })[1])
    expect(await screen.findByRole('dialog', { name: 'VPN guide' })).toBeInTheDocument()
    expect(documentApi.getDocument).toHaveBeenCalledWith(viewFixtures.document.id)
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    await user().click(screen.getByRole('button', { name: 'Delete VPN help' }))
    expect(confirm).toHaveBeenCalledWith('Delete this conversation and its feedback?')
    expect(chatApi.deleteSession).toHaveBeenCalledWith(viewFixtures.session.id)
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
    vi.mocked(chatApi.createSession).mockResolvedValueOnce({ ...viewFixtures.session, messages: [] })
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(new Error('Answer failed'))
    await user().type(screen.getByRole('textbox', { name: 'Your question' }), 'Try again')
    await user().click(screen.getByRole('button', { name: 'Send question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Answer failed')
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('Try again')
  })

  it('creates a session on first send and handles source, rating, feedback and delete failures', async () => {
    vi.mocked(chatApi.listSessions).mockResolvedValue([])
    vi.mocked(documentApi.getDocument).mockRejectedValueOnce(new Error('Document unavailable'))
    vi.mocked(chatApi.submitFeedback)
      .mockRejectedValueOnce(new Error('Rating failed'))
      .mockRejectedValueOnce(new Error('Feedback failed'))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ChatView onBrowseDocuments={vi.fn()} />)
    await screen.findByText('How can we help?')
    await user().type(screen.getByRole('textbox', { name: 'Your question' }), 'First question')
    await user().click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() => expect(chatApi.createSession).toHaveBeenCalledOnce())
    expect(chatApi.sendMessage).toHaveBeenCalledWith('created-1', 'First question', expect.any(Function))
    expect(await screen.findByRole('heading', { name: 'First question' })).toBeInTheDocument()

    await user().click(screen.getByRole('button', { name: /VPN guide/ }))
    expect(await screen.findByText('Document unavailable')).toBeInTheDocument()

    await user().click(screen.getByRole('button', { name: 'Helpful' }))
    expect(await screen.findByText('Rating failed')).toBeInTheDocument()

    await user().click(screen.getByRole('button', { name: 'Not helpful' }))
    await user().click(
      within(screen.getByRole('dialog', { name: 'What could be better?' })).getByRole('button', {
        name: 'Data policy',
      }),
    )
    expect(await screen.findByRole('dialog', { name: 'Current data policy' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'What could be better?' })).not.toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close policy' }))

    await user().click(screen.getByRole('button', { name: 'Not helpful' }))
    await user().click(screen.getByRole('button', { name: 'Submit feedback' }))
    expect(await screen.findByText('Feedback failed')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close feedback' }))

    await user().click(screen.getByRole('button', { name: 'Delete First question' }))
    expect(confirm).toHaveBeenCalled()
    expect(chatApi.deleteSession).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    vi.mocked(chatApi.deleteSession).mockRejectedValueOnce(new Error('Delete failed'))
    await user().click(screen.getByRole('button', { name: 'Delete First question' }))
    expect(await screen.findByText('Delete failed')).toBeInTheDocument()
  })
})
