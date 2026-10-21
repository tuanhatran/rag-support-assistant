import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '../../types/admin'
import { UsersSection } from './UsersSection'
import { componentFixtures } from '../../test/fixtures'

const user = userEvent.setup

describe('UsersSection', () => {
  it('renders staged user edits, model assignment and busy states', async () => {
    const onStartEdit = vi.fn()
    const onCancelEdit = vi.fn()
    const onStageEdit = vi.fn()
    const onConfirmEdit = vi.fn()
    const adminUser = componentFixtures.adminUser
    const rootUser: AdminUser = { ...adminUser, id: 'admin', username: 'root', role: 'admin', plan: 'basic' }
    const props = {
      users: [adminUser, rootUser],
      connections: [componentFixtures.connection],
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
    rerender(
      <UsersSection
        {...props}
        users={[{ ...adminUser, created_at: undefined }]}
        userEdits={{}}
        savingUsers={new Set<string>()}
      />,
    )
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
