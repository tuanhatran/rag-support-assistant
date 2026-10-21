import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PipelineStages } from './PipelineStages'
import { componentFixtures } from '../../test/fixtures'

describe('PipelineStages', () => {
  it('renders all pipeline stage statuses and idle defaults', () => {
    const { rerender } = render(<PipelineStages pipeline={null} />)
    expect(screen.getAllByText('idle')).toHaveLength(4)
    const stages = {
      file_parsing: { status: 'running' as const, latency_ms: 1 },
      chunking: { status: 'done' as const, latency_ms: 2 },
      embedding: { status: 'failed' as const, latency_ms: 3 },
      database_ready: { status: 'idle' as const, latency_ms: 0 },
    }
    rerender(<PipelineStages pipeline={{ ...componentFixtures.pipeline, stages }} />)
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByText('done')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
  })
})
