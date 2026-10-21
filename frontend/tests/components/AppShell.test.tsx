import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../src/components/AppShell'
import { mockApis } from '../support/apiMocks'
import { viewFixtures } from '../support/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('AppShell', () => {
  it('shows admin navigation and closes policy overlay without changing consent', async () => {
    const onSignOut = vi.fn()
    const onDeleted = vi.fn()
    const onPolicyAccepted = vi.fn()
    render(
      <AppShell
        user={{ ...viewFixtures.adminUser, policy_accepted: false }}
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
