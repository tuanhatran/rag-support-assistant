import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import * as ingestionApi from '../api/ingestion'
import type { IngestionOptions, PipelineSummary } from '../types/ingestion'
import { IngestionForm, type IngestionSettings } from './ingestion/IngestionForm'
import { PipelineHistory } from './ingestion/PipelineHistory'

interface IngestionViewProps {
  onOpenPipeline: (pipelineId: string) => void
}

export function IngestionView({ onOpenPipeline }: IngestionViewProps) {
  const [options, setOptions] = useState<IngestionOptions | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submittedPipelineId, setSubmittedPipelineId] = useState<string | null>(null)
  const [history, setHistory] = useState<PipelineSummary[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')

  async function loadHistory() {
    setLoadingHistory(true)
    setHistoryError('')
    try {
      const data = await ingestionApi.listPipelines()
      setHistory(data)
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load ingestion history')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    ingestionApi.getIngestionOptions()
      .then(setOptions)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load options'))

    loadHistory()
  }, [])

  async function handleSubmit(file: File, settings: IngestionSettings) {
    setError('')
    setSubmitting(true)
    setSubmittedPipelineId(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chunk_size', String(settings.chunkSize))
      formData.append('chunk_overlap', String(settings.chunkOverlap))
      formData.append('separator', settings.separator)
      formData.append('embedding_model', settings.embeddingModel)

      const result = await ingestionApi.createPipeline(formData)
      setSubmittedPipelineId(result.id)
      loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ingestion pipeline')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-section ingestion-view">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">DOCUMENT INGESTION &amp; EMBEDDING</span>
          <h2>Document Ingestion Pipeline</h2>
          <p>Upload documentation to parse, redact sensitive data, chunk, embed, and store vectors in PostgreSQL pgvector.</p>
        </div>
      </div>

      {submittedPipelineId && (
        <div className="inline-success page-alert pipeline-success-banner">
          <div className="pipeline-success-content">
            <CheckCircle2 size={18} />
            <span>
              Ingestion pipeline created successfully! <b>ID:</b>{' '}
              <button
                type="button"
                className="pipeline-id-link"
                onClick={() => onOpenPipeline(submittedPipelineId)}
              >
                {submittedPipelineId}
              </button>
            </span>
          </div>
          <button
            type="button"
            className="button button-primary pipeline-view-btn"
            onClick={() => onOpenPipeline(submittedPipelineId)}
          >
            View Pipeline <ArrowRight size={14} />
          </button>
        </div>
      )}

      <IngestionForm options={options} submitting={submitting} error={error} onError={setError} onSelectionChange={() => setSubmittedPipelineId(null)} onSubmit={handleSubmit} />

      <PipelineHistory pipelines={history} loading={loadingHistory} error={historyError} onRefresh={loadHistory} onDismissError={() => setHistoryError('')} onOpen={onOpenPipeline} />
    </section>
  )
}
