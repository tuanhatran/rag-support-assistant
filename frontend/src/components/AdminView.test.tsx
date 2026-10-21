import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as adminApi from '../api/admin'
import { AdminView } from './AdminView'
import { mockApis } from '../test/apiMocks'
import { viewFixtures } from '../test/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('AdminView', () => {
  it('loads admin tabs, saves a connection, edits a user, filters feedback and audit', async () => {
    render(<AdminView />)
    expect(await screen.findByRole('heading', { name: 'Connections' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Test Standard' }))
    expect(await screen.findByText('Connection test succeeded.')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Add connection' }))
    await user().type(screen.getByLabelText('Name'), 'New route')
    await user().click(screen.getByRole('button', { name: 'Save connection' }))
    await waitFor(() => expect(adminApi.saveConnection).toHaveBeenCalled())
    expect(await screen.findByText('Connection created.')).toBeInTheDocument()

    await user().click(screen.getByRole('tab', { name: 'Users' }))
    expect(await screen.findByText('casey')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Edit casey' }))
    await user().selectOptions(screen.getByLabelText('Plan for casey'), 'premium')
    await user().click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(adminApi.updateUser).toHaveBeenCalledWith('account-1', { plan: 'premium' }))

    await user().click(screen.getByRole('tab', { name: 'Chat feedback' }))
    expect(await screen.findByText('VPN broken')).toBeInTheDocument()
    await user().selectOptions(screen.getByRole('combobox'), 'up')
    await waitFor(() => expect(adminApi.listFeedback).toHaveBeenLastCalledWith('up'))

    await user().click(screen.getByRole('tab', { name: 'Audit log' }))
    await user().type(screen.getByLabelText('Event'), 'auth.login')
    await user().click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() =>
      expect(adminApi.listAudit).toHaveBeenLastCalledWith({ event: 'auth.login', outcome: '', username: '' }),
    )
  })

  it('handles admin request and connection deletion failures safely', async () => {
    vi.mocked(adminApi.testConnection).mockRejectedValueOnce(new Error('Connection test failed'))
    vi.mocked(adminApi.listConnections).mockResolvedValue([{ ...viewFixtures.connection, plans: [] }])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AdminView />)
    await screen.findByRole('heading', { name: 'Connections' })
    await user().click(screen.getByRole('button', { name: 'Test Standard' }))
    expect(await screen.findByText('Connection test failed')).toBeInTheDocument()
    vi.mocked(adminApi.deleteConnection).mockRejectedValueOnce(new Error('Cannot delete'))
    await user().click(screen.getByRole('button', { name: 'Delete Standard' }))
    expect(confirm).toHaveBeenCalledWith('Delete Standard?')
    expect(await screen.findByText('Cannot delete')).toBeInTheDocument()
  })

  it('opens the ingestion pipeline from admin and closes the connection form', async () => {
    const { container } = render(<AdminView />)
    await screen.findByRole('heading', { name: 'Connections' })
    await user().click(screen.getByRole('button', { name: 'Add connection' }))
    expect(screen.getByRole('dialog', { name: 'Add connection' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close form' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user().click(screen.getByRole('tab', { name: 'Ingestion' }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user().upload(input, new File(['runbook'], 'guide.txt', { type: 'text/plain' }))
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    await user().click(await screen.findByRole('button', { name: 'View Pipeline' }))
    expect(await screen.findByRole('heading', { name: 'runbook.txt' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Back to Ingestion' }))
    expect(screen.getByRole('heading', { name: 'Document Ingestion Pipeline' })).toBeInTheDocument()
  })

  it('surfaces admin load and update failures across tabs', async () => {
    vi.mocked(adminApi.listConnections).mockRejectedValueOnce(new Error('Connections offline'))
    render(<AdminView />)
    expect(await screen.findByText('Connections offline')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Dismiss message' }))

    vi.mocked(adminApi.listUsers).mockRejectedValueOnce(new Error('Users offline'))
    await user().click(screen.getByRole('tab', { name: 'Users' }))
    expect(await screen.findByText('Users offline')).toBeInTheDocument()

    vi.mocked(adminApi.listFeedback).mockRejectedValueOnce(new Error('Feedback offline'))
    await user().click(screen.getByRole('tab', { name: 'Chat feedback' }))
    expect(await screen.findByText('Feedback offline')).toBeInTheDocument()

    vi.mocked(adminApi.listAudit).mockRejectedValueOnce(new Error('Audit offline'))
    await user().click(screen.getByRole('tab', { name: 'Audit log' }))
    expect(await screen.findByText('Audit offline')).toBeInTheDocument()

    await user().click(screen.getByRole('tab', { name: 'Users' }))
    await user().click(await screen.findByRole('button', { name: 'Edit casey' }))
    await user().selectOptions(screen.getByLabelText('Plan for casey'), 'premium')
    vi.mocked(adminApi.updateUser).mockRejectedValueOnce(new Error('Update failed'))
    await user().click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Update failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()

    await user().click(screen.getByRole('tab', { name: 'Audit log' }))
    vi.mocked(adminApi.listAudit).mockRejectedValueOnce(new Error('Audit submit failed'))
    await user().click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByText('Audit submit failed')).toBeInTheDocument()
  })
})
