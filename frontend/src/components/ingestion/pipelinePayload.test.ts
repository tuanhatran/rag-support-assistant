import { describe, expect, it } from 'vitest'
import { createPipelineExportPayload } from './pipelinePayload'
import { componentFixtures } from '../../test/fixtures'

describe('pipelinePayload', () => {
  it('constructs compact and full export payloads without leaking extra chunk fields', () => {
    expect(createPipelineExportPayload(null, [])).toEqual({
      id: undefined,
      filename: undefined,
      file_size: undefined,
      status: undefined,
      options: undefined,
      chunk_count: undefined,
      stages: undefined,
      chunks: [],
    })
    expect(createPipelineExportPayload(componentFixtures.pipeline, [componentFixtures.chunk])).toMatchObject({
      chunks: [{ index: 0, content: 'Chunk text' }],
    })
    expect(createPipelineExportPayload(componentFixtures.pipeline, [componentFixtures.chunk], true)).toHaveProperty(
      'created_at',
      componentFixtures.pipeline.created_at,
    )
  })
})
