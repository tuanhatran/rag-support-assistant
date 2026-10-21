import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '../../src/components/LoginPage'
import { mockApis } from '../support/apiMocks'

const user = userEvent.setup

beforeEach(mockApis)

describe('LoginPage', () => {
  it('opens and closes the data policy from the login screen', async () => {
    render(<LoginPage onAuthenticated={vi.fn()} />)
    await user().click(screen.getByRole('tab', { name: 'Create account' }))
    await user().click(screen.getByRole('button', { name: 'data policy' }))
    expect(await screen.findByRole('dialog', { name: 'Current data policy' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close policy' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
