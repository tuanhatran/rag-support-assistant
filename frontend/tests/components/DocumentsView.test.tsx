import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as documentApi from '../../src/api/documents'
import { DocumentsView } from '../../src/components/DocumentsView'
import { mockApis } from '../support/apiMocks'
import { viewFixtures } from '../support/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('DocumentsView', () => {
  it('loads document filters, opens and closes reader, and reports list/detail errors', async () => {
    vi.mocked(documentApi.listDocuments).mockResolvedValue([viewFixtures.document])
    render(<DocumentsView />)
    expect(await screen.findByRole('button', { name: /VPN guide/ })).toBeInTheDocument()
    await user().type(screen.getByRole('textbox', { name: 'Search documents' }), 'password')
    await waitFor(() =>
      expect(documentApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'password' })),
    )
    await user().click(screen.getByRole('button', { name: /VPN guide/ }))
    expect(await screen.findByRole('heading', { name: 'VPN guide' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Close document' }))
    expect(screen.getByText('Choose a document')).toBeInTheDocument()
    vi.mocked(documentApi.getDocument).mockRejectedValueOnce(new Error('Document unavailable'))
    await user().click(screen.getByRole('button', { name: /VPN guide/ }))
    expect(await screen.findByText('Document unavailable')).toBeInTheDocument()
  })

  it('clears the selected tag when changing category and reports list and detail failures', async () => {
    vi.mocked(documentApi.listDocuments).mockResolvedValue([viewFixtures.document])
    render(<DocumentsView />)
    await screen.findByRole('button', { name: /VPN guide/ })
    await user().click(screen.getByRole('button', { name: 'vpn' }))
    await waitFor(() =>
      expect(documentApi.listDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ tag: 'vpn' })),
    )
    vi.mocked(documentApi.listDocuments).mockRejectedValueOnce(new Error('List offline'))
    await user().selectOptions(screen.getByRole('combobox', { name: 'Filter by category' }), 'Network')
    expect(await screen.findByText('List offline')).toBeInTheDocument()
    expect(documentApi.listDocuments).toHaveBeenLastCalledWith({ query: '', category: 'Network', tag: '' })

    vi.mocked(documentApi.getDocument).mockRejectedValueOnce('plain failure')
    await user().click(screen.getByRole('button', { name: /VPN guide/ }))
    expect(await screen.findByText('Could not load the document.')).toBeInTheDocument()
  })
})
