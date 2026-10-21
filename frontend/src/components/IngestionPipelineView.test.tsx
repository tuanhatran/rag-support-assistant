import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ingestionApi from '../api/ingestion'
import { IngestionPipelineView } from './IngestionPipelineView'
import { mockApis } from '../test/apiMocks'
import { viewFixtures } from '../test/fixtures'

const user = userEvent.setup

beforeEach(mockApis)

describe('IngestionPipelineView', () => {
  it('renders completed pipeline details, chunk preview, errors and back navigation', async () => {
    const onBack = vi.fn()
    render(<IngestionPipelineView pipelineId={viewFixtures.pipeline.id} onBack={onBack} />)
    expect(await screen.findByRole('heading', { name: 'runbook.txt' })).toBeInTheDocument()
    expect(await screen.findByText('Chunk #1')).toBeInTheDocument()
    expect(ingestionApi.getPipelineChunks).toHaveBeenCalledWith(viewFixtures.pipeline.id)
    await user().click(screen.getByRole('tab', { name: /Extracted Text/ }))
    expect(screen.getByText('Redacted source text')).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Back to Ingestion' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('polls queued pipeline, stops at failed state, and displays retryable fetch error', async () => {
    vi.useFakeTimers()
    const pending = { ...viewFixtures.pipeline, status: 'running' as const, error: 'Provider failed' }
    vi.mocked(ingestionApi.getPipeline)
      .mockResolvedValueOnce(pending)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ...viewFixtures.pipeline, status: 'failed', error: 'Pipeline stopped' })
    const onBack = vi.fn()
    render(<IngestionPipelineView pipelineId={viewFixtures.pipeline.id} onBack={onBack} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText(/Pipeline error: Provider failed/)).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText('Network error')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText(/Pipeline error: Pipeline stopped/)).toBeInTheDocument()
    expect(ingestionApi.getPipelineChunks).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
