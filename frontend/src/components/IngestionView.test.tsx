import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ingestionApi from '../api/ingestion'
import { IngestionView } from './IngestionView'
import { mockApis } from '../test/apiMocks'
import { viewFixtures } from '../test/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('IngestionView', () => {
  it('submits an uploaded document and routes to its pipeline', async () => {
    const onOpenPipeline = vi.fn()
    const { container } = render(<IngestionView onOpenPipeline={onOpenPipeline} />)
    await screen.findByText('Model A')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user().upload(input, new File(['support runbook'], 'guide.txt', { type: 'text/plain' }))
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    await waitFor(() => expect(ingestionApi.createPipeline).toHaveBeenCalled())
    expect(await screen.findByText(viewFixtures.pipeline.id)).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'View Pipeline' }))
    expect(onOpenPipeline).toHaveBeenCalledWith(viewFixtures.pipeline.id)
  })

  it('reports option and submission failures, then opens the created pipeline by ID', async () => {
    vi.mocked(ingestionApi.getIngestionOptions).mockRejectedValueOnce(new Error('Options offline'))
    const onOpenPipeline = vi.fn()
    const { container } = render(<IngestionView onOpenPipeline={onOpenPipeline} />)
    expect(await screen.findByText('Options offline')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByText('Options offline')).not.toBeInTheDocument()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user().upload(input, new File(['runbook'], 'guide.txt', { type: 'text/plain' }))
    vi.mocked(ingestionApi.createPipeline).mockRejectedValueOnce(new Error('Pipeline rejected'))
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    expect(await screen.findByText('Pipeline rejected')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Dismiss error' }))

    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    await user().click(await screen.findByRole('button', { name: viewFixtures.pipeline.id }))
    expect(onOpenPipeline).toHaveBeenCalledWith(viewFixtures.pipeline.id)
  })

  it('reports ingestion history failures and clears them', async () => {
    vi.mocked(ingestionApi.listPipelines).mockRejectedValueOnce(new Error('History offline'))
    render(<IngestionView onOpenPipeline={vi.fn()} />)
    expect(await screen.findByText('History offline')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByText('History offline')).not.toBeInTheDocument()
  })

  it('falls back to default messages for non-error ingestion failures', async () => {
    vi.mocked(ingestionApi.getIngestionOptions).mockRejectedValueOnce('offline')
    vi.mocked(ingestionApi.listPipelines).mockRejectedValueOnce('offline')
    vi.mocked(ingestionApi.createPipeline).mockRejectedValueOnce('offline')
    const { container } = render(<IngestionView onOpenPipeline={vi.fn()} />)
    expect(await screen.findByText('Failed to load options')).toBeInTheDocument()
    expect(await screen.findByText('Failed to load ingestion history')).toBeInTheDocument()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user().upload(input, new File(['runbook'], 'guide.txt', { type: 'text/plain' }))
    await user().click(screen.getByRole('button', { name: 'Process & Ingest Document' }))
    expect(await screen.findByText('Failed to start ingestion pipeline')).toBeInTheDocument()
  })
})
