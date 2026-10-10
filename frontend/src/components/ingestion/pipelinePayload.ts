import type { ChunkPreview, IngestionPipeline } from '../../types'

export function createPipelineExportPayload(pipeline: IngestionPipeline | null, chunks: ChunkPreview[], includeCreatedAt = false) {
  const payload = {
    id: pipeline?.id,
    filename: pipeline?.filename,
    file_size: pipeline?.file_size,
    status: pipeline?.status,
    options: pipeline?.options,
    chunk_count: pipeline?.chunk_count,
    stages: pipeline?.stages,
  }
  return {
    ...payload,
    ...(includeCreatedAt ? { created_at: pipeline?.created_at } : {}),
    chunks: chunks.map(({ index, content, model, dimensions }) => ({ index, content, model, dimensions })),
  }
}