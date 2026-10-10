import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, XCircle } from 'lucide-react'
import { getPipeline, getPipelineChunks } from '../api/ingestion'
import type { ChunkPreview, IngestionPipeline } from '../types/ingestion'
import { PipelineDetails } from './ingestion/PipelineDetails'
import { PipelineStages } from './ingestion/PipelineStages'

interface IngestionPipelineViewProps {
  pipelineId: string
  onBack: () => void
}

export function IngestionPipelineView({ pipelineId, onBack }: IngestionPipelineViewProps) {
  const [pipeline, setPipeline] = useState<IngestionPipeline | null>(null)
  const [chunks, setChunks] = useState<ChunkPreview[]>([])
  const [error, setError] = useState('')

  // Poll pipeline status every 1 second until completed or failed
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>
    let cancelled = false

    async function fetchPipeline() {
      try {
        const data = await getPipeline(pipelineId)
        if (cancelled) return
        setPipeline(data)
        setError('')

        if (data.status === 'completed') {
          // Fetch chunks preview
          try {
            const chunkList = await getPipelineChunks(pipelineId)
            if (!cancelled) setChunks(chunkList)
          } catch {
            // ignore chunk preview fetch error
          }
          return
        }

        if (data.status === 'failed') {
          return
        }

        // Keep polling if queued or running
        timerId = setTimeout(fetchPipeline, 1000)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch pipeline details')
          timerId = setTimeout(fetchPipeline, 1000)
        }
      }
    }

    fetchPipeline()

    return () => {
      cancelled = true
      clearTimeout(timerId)
    }
  }, [pipelineId])

  const totalLatencyMs = pipeline?.stages
    ? Object.values(pipeline.stages).reduce((sum, stage) => sum + (stage.latency_ms || 0), 0)
    : 0

  return (
    <div className="admin-section pipeline-detail-view">
      <div className="pipeline-header">
        <div className="pipeline-header-left">
          <button type="button" className="button button-subtle back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Ingestion
          </button>
          <div>
            <div className="pipeline-title-row">
              <h2>{pipeline?.filename || 'Document Ingestion'}</h2>
              {pipeline && (
                <span className={`status-pill ${pipeline.status}`}>
                  {pipeline.status === 'running' && <Loader2 size={12} className="spin" />}
                  {pipeline.status.toUpperCase()}
                </span>
              )}
            </div>
            <p className="pipeline-meta">
              <span>Pipeline ID: <code>{pipelineId}</code></span>
              {pipeline && (
                <>
                  <span>Size: {(pipeline.file_size / 1024).toFixed(1)} KB</span>
                  <span>Model: <b>{pipeline.options.embedding_model}</b></span>
                  <span>Total Latency: <b>{totalLatencyMs} ms</b></span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="form-error page-alert">{error}</div>}
      {pipeline?.error && (
        <div className="form-error page-alert">
          <XCircle size={16} /> Pipeline error: {pipeline.error}
        </div>
      )}

      <PipelineStages pipeline={pipeline} />
      <PipelineDetails pipeline={pipeline} chunks={chunks} onError={setError} />
    </div>
  )
}
