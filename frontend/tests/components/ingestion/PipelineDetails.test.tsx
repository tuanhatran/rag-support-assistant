import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PipelineDetails } from '../../../src/components/ingestion/PipelineDetails'
import { componentFixtures } from '../../support/fixtures'

describe('PipelineDetails', () => {
  it('shows chunk, extracted text, and export tabs with clipboard outcomes', async () => {
    const pipeline = componentFixtures.pipeline
    const chunk = componentFixtures.chunk
    const onError = vi.fn()
    const actor = userEvent.setup()
    const { rerender } = render(<PipelineDetails pipeline={pipeline} chunks={[]} onError={onError} />)
    expect(screen.getByText('No chunks were generated from this document.')).toBeInTheDocument()
    rerender(<PipelineDetails pipeline={{ ...pipeline, status: 'running' }} chunks={[]} onError={onError} />)
    expect(screen.getByText('Chunks will appear here once the pipeline completes.')).toBeInTheDocument()
    await actor.click(screen.getByRole('tab', { name: /Chunk Inspector/ }))
    rerender(
      <PipelineDetails
        pipeline={{ ...pipeline, status: 'running', extracted_text: '' }}
        chunks={[chunk]}
        onError={onError}
      />,
    )
    expect(screen.getByText('Chunk #1')).toBeInTheDocument()
    await actor.click(screen.getByRole('tab', { name: /Extracted Text/ }))
    expect(screen.getByText('(No text extracted yet)')).toBeInTheDocument()
    await actor.click(screen.getByRole('tab', { name: /Export Payload/ }))
    expect(screen.getByText(/"filename": "runbook.txt"/)).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Copy JSON' }))
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('clipboard unavailable'))
    await actor.click(screen.getByRole('button', { name: 'Copied!' }))
    expect(onError).toHaveBeenCalledWith('Failed to copy payload to clipboard')
    rerender(<PipelineDetails pipeline={null} chunks={[chunk]} onError={onError} />)
    expect(screen.getByRole('tab', { name: /Chunk Inspector \(1\)/ })).toBeInTheDocument()
    await actor.click(screen.getByRole('tab', { name: /Export Payload/ }))
    await actor.click(screen.getByRole('button', { name: 'Copied!' }))
    expect(onError).toHaveBeenCalledOnce()
  })
})
