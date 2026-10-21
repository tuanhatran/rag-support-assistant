import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PipelineSummary } from '../../../src/types/ingestion'
import { PipelineHistory } from '../../../src/components/ingestion/PipelineHistory'
import { componentFixtures } from '../../support/fixtures'

const user = userEvent.setup

describe('PipelineHistory', () => {
  it('shows pipeline history loading, errors, empty, and populated states', async () => {
    const onRefresh = vi.fn()
    const onDismissError = vi.fn()
    const onOpen = vi.fn()
    const pipeline = componentFixtures.pipeline
    const summary: PipelineSummary = {
      id: pipeline.id,
      filename: pipeline.filename,
      file_size: pipeline.file_size,
      status: pipeline.status,
      options: pipeline.options,
      chunk_count: pipeline.chunk_count,
      error: pipeline.error,
      created_at: pipeline.created_at,
      expires_at: pipeline.expires_at,
    }
    const props = { pipelines: [], loading: true, error: '', onRefresh, onDismissError, onOpen }
    const { rerender } = render(<PipelineHistory {...props} />)
    expect(screen.getByText('Loading ingestion history...')).toBeInTheDocument()
    rerender(<PipelineHistory {...props} loading={false} />)
    expect(screen.getByText('No ingestion pipelines yet.')).toBeInTheDocument()
    rerender(<PipelineHistory {...props} loading={false} error="History failed" />)
    expect(screen.queryByText('No ingestion pipelines yet.')).not.toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Dismiss error' }))
    rerender(<PipelineHistory {...props} loading={false} pipelines={[summary]} />)
    await user().click(screen.getByRole('button', { name: /runbook.txt/ }))
    await user().click(screen.getByRole('button', { name: 'Refresh ingestion history' }))
    expect(onOpen).toHaveBeenCalledWith(summary.id)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onDismissError).toHaveBeenCalledOnce()
    rerender(
      <PipelineHistory
        {...props}
        loading={false}
        pipelines={[{ ...summary, id: 'old', created_at: '', chunk_count: 0 }]}
      />,
    )
    expect(screen.getByText('-')).toBeInTheDocument()
    expect(screen.getByText('0 chunks')).toBeInTheDocument()
  })
})
