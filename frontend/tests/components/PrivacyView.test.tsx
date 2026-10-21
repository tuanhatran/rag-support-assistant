import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as privacyApi from '../../src/api/privacy'
import { PrivacyView } from '../../src/components/PrivacyView'
import { mockApis } from '../support/apiMocks'

const user = userEvent.setup

beforeEach(mockApis)

describe('PrivacyView', () => {
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

  it('reports policy, export, erasure and deletion failures and honors delete cancellation', async () => {
    vi.mocked(privacyApi.getPolicy).mockRejectedValueOnce(new Error('Policy offline'))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(privacyApi.exportUserData)
      .mockRejectedValueOnce(new Error('Export unavailable'))
      .mockRejectedValueOnce('plain export failure')
    vi.mocked(privacyApi.eraseUserData)
      .mockRejectedValueOnce(new Error('Erasure unavailable'))
      .mockRejectedValueOnce('plain erasure failure')
    vi.mocked(privacyApi.deleteUserAccount)
      .mockRejectedValueOnce(new Error('Delete unavailable'))
      .mockRejectedValueOnce('plain deletion failure')
    render(<PrivacyView onDeleted={vi.fn()} />)
    expect(await screen.findByText('Policy offline')).toBeInTheDocument()

    await user().click(screen.getByRole('button', { name: /Export data/ }))
    expect(await screen.findByText('Export unavailable')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Export data/ }))
    expect(await screen.findByText('Export failed.')).toBeInTheDocument()

    await user().click(screen.getByRole('button', { name: /Delete conversations/ }))
    expect(await screen.findByText('Erasure unavailable')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Delete conversations/ }))
    expect(await screen.findByText('Data erasure failed.')).toBeInTheDocument()

    await user().type(screen.getByLabelText('Confirm password'), 'password')
    await user().click(screen.getByRole('button', { name: /Delete account permanently/ }))
    expect(await screen.findByText('Delete unavailable')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: /Delete account permanently/ }))
    expect(await screen.findByText('Account deletion failed.')).toBeInTheDocument()
    confirm.mockReturnValue(false)
    await user().click(screen.getByRole('button', { name: /Delete account permanently/ }))
    expect(privacyApi.deleteUserAccount).toHaveBeenCalledTimes(2)
  })
})
