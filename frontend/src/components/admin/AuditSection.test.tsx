import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AuditEntry } from '../../types/admin'
import { AuditSection } from './AuditSection'

const user = userEvent.setup

describe('AuditSection', () => {
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
