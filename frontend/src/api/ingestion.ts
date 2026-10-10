import { api } from '../api'
import type { ChunkPreview, IngestionOptions, IngestionPipeline, PipelineSummary } from '../types/ingestion'

export const getIngestionOptions = () => api.get<IngestionOptions>('/admin/ingestion/options')
export const listPipelines = () => api.get<PipelineSummary[]>('/admin/ingestion/pipelines')
export const createPipeline = (formData: FormData) =>
  api.postForm<{ id: string; status: string }>('/admin/ingestion/pipelines', formData)
export const getPipeline = (pipelineId: string) =>
  api.get<IngestionPipeline>(`/admin/ingestion/pipelines/${pipelineId}`)
export const getPipelineChunks = (pipelineId: string) =>
  api.get<ChunkPreview[]>(`/admin/ingestion/pipelines/${pipelineId}/chunks`)