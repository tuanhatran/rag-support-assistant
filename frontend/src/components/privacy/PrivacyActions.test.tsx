import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PrivacyActions } from './PrivacyActions'

const user = userEvent.setup

describe('PrivacyActions', () => {
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
