import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  FileSearch,
  FileText,
  Layers,
  Loader2,
  Share2,
  XCircle,
} from 'lucide-react'
import { api } from '../api'
import type { ChunkPreview, IngestionPipeline, StageInfo, StageStatus } from '../types'

interface IngestionPipelineViewProps {
  pipelineId: string
  onBack: () => void
}

type RightTab = 'chunks' | 'text' | 'export'

export function IngestionPipelineView({ pipelineId, onBack }: IngestionPipelineViewProps) {
  const [pipeline, setPipeline] = useState<IngestionPipeline | null>(null)
  const [chunks, setChunks] = useState<ChunkPreview[]>([])
  const [activeTab, setActiveTab] = useState<RightTab>('chunks')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Poll pipeline status every 1 second until completed or failed
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>
    let cancelled = false

    async function fetchPipeline() {
      try {
        const data = await api.get<IngestionPipeline>(`/admin/ingestion/pipelines/${pipelineId}`)
        if (cancelled) return
        setPipeline(data)
        setError('')

        if (data.status === 'completed') {
          // Fetch chunks preview
          try {
            const chunkList = await api.get<ChunkPreview[]>(`/admin/ingestion/pipelines/${pipelineId}/chunks`)
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

  async function copyPayload() {
    if (!pipeline) return
    const exportPayload = {
      id: pipeline.id,
      filename: pipeline.filename,
      file_size: pipeline.file_size,
      status: pipeline.status,
      options: pipeline.options,
      chunk_count: pipeline.chunk_count,
      stages: pipeline.stages,
      created_at: pipeline.created_at,
      chunks: chunks.map(c => ({
        index: c.index,
        content: c.content,
        model: c.model,
        dimensions: c.dimensions,
      })),
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy payload to clipboard')
    }
  }

  const stageList: { key: keyof IngestionPipeline['stages']; label: string; icon: typeof FileText }[] = [
    { key: 'file_parsing', label: 'File Parsing', icon: FileSearch },
    { key: 'chunking', label: 'Chunking', icon: Layers },
    { key: 'embedding', label: 'Embedding', icon: Cpu },
    { key: 'database_ready', label: 'Database Ready', icon: Database },
  ]

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

      {/* Stage Cards */}
      <div className="stage-cards-grid">
        {stageList.map((stageItem, index) => {
          const stageInfo: StageInfo = pipeline?.stages?.[stageItem.key] || {
            status: 'idle',
            latency_ms: 0,
          }
          return (
            <div key={stageItem.key} className={`stage-card ${stageInfo.status}`}>
              <div className="stage-card-step">Stage 0{index + 1}</div>
              <div className="stage-card-body">
                <div className="stage-card-title">
                  <stageItem.icon size={18} />
                  <b>{stageItem.label}</b>
                </div>
                <div className="stage-card-meta">
                  <span className={`stage-status-indicator ${stageInfo.status}`}>
                    {renderStatusIcon(stageInfo.status)}
                    {stageInfo.status}
                  </span>
                  <span className="stage-latency">
                    <Clock size={12} /> {stageInfo.latency_ms} ms
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Right / Bottom Tabs Container */}
      <div className="pipeline-details-panel">
        <div className="panel-tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'chunks'}
            className={activeTab === 'chunks' ? 'selected' : ''}
            onClick={() => setActiveTab('chunks')}
          >
            <Layers size={14} /> Chunk Inspector ({pipeline?.chunk_count ?? chunks.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'text'}
            className={activeTab === 'text' ? 'selected' : ''}
            onClick={() => setActiveTab('text')}
          >
            <FileText size={14} /> Extracted Text
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'export'}
            className={activeTab === 'export' ? 'selected' : ''}
            onClick={() => setActiveTab('export')}
          >
            <Share2 size={14} /> Export Payload
          </button>
        </div>

        <div className="panel-tab-content">
          {activeTab === 'chunks' && (
            <div className="chunks-tab">
              {chunks.length === 0 ? (
                <div className="panel-empty">
                  {pipeline?.status === 'completed'
                    ? 'No chunks were generated from this document.'
                    : 'Chunks will appear here once the pipeline completes.'}
                </div>
              ) : (
                <div className="chunks-list">
                  {chunks.map(chunk => (
                    <article key={chunk.index} className="chunk-card">
                      <div className="chunk-card-head">
                        <span className="chunk-badge">Chunk #{chunk.index + 1}</span>
                        <span className="chunk-length">{chunk.content.length} chars</span>
                        <span className="chunk-meta-pill">{chunk.model} ({chunk.dimensions}d)</span>
                      </div>
                      <pre className="chunk-content">{chunk.content}</pre>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="extracted-text-tab">
              <div className="text-banner">
                Sensitive keys, credentials, and tokens are automatically redacted via <code>redact()</code> before storage.
              </div>
              <pre className="extracted-text-content">
                {pipeline?.extracted_text || '(No text extracted yet)'}
              </pre>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="export-payload-tab">
              <div className="export-toolbar">
                <span>Payload includes metadata and chunk content (vectors excluded for security &amp; bandwidth).</span>
                <button type="button" className="button button-subtle copy-btn" onClick={copyPayload}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="export-json-content">
                {JSON.stringify(
                  {
                    id: pipeline?.id,
                    filename: pipeline?.filename,
                    file_size: pipeline?.file_size,
                    status: pipeline?.status,
                    options: pipeline?.options,
                    chunk_count: pipeline?.chunk_count,
                    stages: pipeline?.stages,
                    chunks: chunks.map(c => ({
                      index: c.index,
                      content: c.content,
                      model: c.model,
                      dimensions: c.dimensions,
                    })),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderStatusIcon(status: StageStatus) {
  switch (status) {
    case 'running':
      return <Loader2 size={13} className="spin" />
    case 'done':
      return <CheckCircle2 size={13} />
    case 'failed':
      return <XCircle size={13} />
    default:
      return <Clock size={13} />
  }
}
