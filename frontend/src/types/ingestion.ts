export interface EmbeddingModelOption {
  id: string
  label: string
  dimensions: number
  target: string
}

export interface SeparatorOption {
  value: string
  label: string
}

export interface IngestionOptions {
  models: EmbeddingModelOption[]
  separators: SeparatorOption[]
  chunk_size: { min: number; max: number; default: number }
  chunk_overlap: { min: number; default: number }
}

export type StageStatus = 'idle' | 'running' | 'done' | 'failed'
export type PipelineStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface StageInfo {
  status: StageStatus
  latency_ms: number
}

export interface IngestionPipeline {
  id: string
  filename: string
  file_size: number
  status: PipelineStatus
  options: {
    chunk_size: number
    chunk_overlap: number
    separator: string
    embedding_model: string
  }
  stages: {
    file_parsing: StageInfo
    chunking: StageInfo
    embedding: StageInfo
    database_ready: StageInfo
  }
  chunk_count: number
  extracted_text: string
  error: string | null
  created_at: string | null
  expires_at: string | null
}

export type PipelineSummary = Pick<
  IngestionPipeline,
  'id' | 'filename' | 'file_size' | 'status' | 'options' | 'chunk_count' | 'error' | 'created_at' | 'expires_at'
>

export interface ChunkPreview {
  index: number
  content: string
  model: string
  dimensions: number
}
