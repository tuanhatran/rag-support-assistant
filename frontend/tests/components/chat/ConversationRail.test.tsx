import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConversationRail } from '../../../src/components/chat/ConversationRail'
import { componentFixtures } from '../../support/fixtures'

const user = userEvent.setup

describe('ConversationRail', () => {
  it('shows conversation loading, empty, and populated states with actions', async () => {
    const onCreate = vi.fn()
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    const onBrowse = vi.fn()
    const props = { sessions: [], loading: true, onCreate, onSelect, onDelete, onBrowseDocuments: onBrowse }
    const { container, rerender } = render(<ConversationRail {...props} />)
    expect(screen.getByText('Loading history...')).toBeInTheDocument()
    rerender(<ConversationRail {...props} loading={false} />)
    expect(screen.getByText(/recent conversations/)).toBeInTheDocument()
    const session = componentFixtures.emptySession
    rerender(<ConversationRail {...props} loading={false} sessions={[session]} activeSessionId={session.id} />)
    expect(screen.getAllByText('New conversation')).toHaveLength(2)
    await user().click(screen.getAllByRole('button', { name: 'New conversation' })[0])
    await user().click(screen.getByRole('button', { name: 'Browse knowledge base' }))
    await user().click(screen.getByRole('button', { name: /^Delete/ }))
    await user().click(screen.getAllByRole('button', { name: 'New conversation' })[1])
    await user().click(container.querySelector('.thread-select')!)
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(onBrowse).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(session.id)
    expect(onSelect).toHaveBeenCalledWith(session.id)
  })
})
