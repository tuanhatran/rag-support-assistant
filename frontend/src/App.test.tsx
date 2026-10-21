import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './api'
import * as authApi from './api/auth'
import { mockApis } from './test/apiMocks'
import { viewFixtures } from './test/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('App', () => {
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

  it('accepts blocking policy, navigates for standard user, and signs out despite request failure', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ ...viewFixtures.standardUser, policy_accepted: false })
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

  it('returns to login when the session becomes unauthorized or the account is deleted', async () => {
    const handlerSpy = vi.spyOn(api, 'setUnauthorizedHandler')
    render(<App />)
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    const handleUnauthorized = handlerSpy.mock.calls[0][0] as () => void
    expect(handleUnauthorized).toBeTypeOf('function')
    act(() => handleUnauthorized())
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()

    await user().type(screen.getByLabelText('Username'), 'ava')
    await user().type(screen.getByLabelText('Password'), 'password')
    await user().click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('navigation', { name: 'Main navigation' })
    await user().click(screen.getByRole('button', { name: 'Privacy' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user().type(await screen.findByLabelText('Confirm password'), 'password')
    await user().click(screen.getByRole('button', { name: /Delete account permanently/ }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})
