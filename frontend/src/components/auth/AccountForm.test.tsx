import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../api/auth'
import { AccountForm } from './AccountForm'
import { mockApis } from '../../test/apiMocks'
import { viewFixtures } from '../../test/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('AccountForm', () => {
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
    expect(onAuthenticated).toHaveBeenCalledWith(viewFixtures.standardUser)
  })

  it('falls back when plan options fail, reports sign-in errors, and clears them on tab switch', async () => {
    vi.mocked(authApi.getPlanOptions).mockRejectedValueOnce(new Error('Plans offline'))
    vi.mocked(authApi.signIn).mockRejectedValueOnce(new Error('Bad credentials'))
    render(<AccountForm onAuthenticated={vi.fn()} onOpenPolicy={vi.fn()} />)
    await user().click(screen.getByRole('tab', { name: 'Create account' }))
    expect(await screen.findAllByText('Support model access')).toHaveLength(3)
    expect(screen.getAllByText('Model unavailable')).toHaveLength(3)
    await user().click(screen.getByRole('tab', { name: 'Sign in' }))
    await user().type(screen.getByLabelText('Username'), 'ava')
    await user().type(screen.getByLabelText('Password'), 'secret')
    await user().click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad credentials')
    await user().click(screen.getByRole('tab', { name: 'Sign in' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
