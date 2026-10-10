import { FileText, RefreshCw } from 'lucide-react'
import type { PipelineSummary } from '../../types/ingestion'

interface PipelineHistoryProps {
  pipelines: PipelineSummary[]
  loading: boolean
  error: string
  onRefresh: () => void
  onDismissError: () => void
  onOpen: (pipelineId: string) => void
}

export function PipelineHistory({
  pipelines,
  loading,
  error,
  onRefresh,
  onDismissError,
  onOpen,
}: PipelineHistoryProps) {
  return (
    <div className="ingestion-history-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">PIPELINE HISTORY</span>
          <h3>History</h3>
          <p>Previous document ingestion pipelines and processing status.</p>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Refresh history"
          aria-label="Refresh ingestion history"
          onClick={onRefresh}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {error && (
        <div className="form-error page-alert">
          {error}
          <button className="icon-button" aria-label="Dismiss error" onClick={onDismissError}>
            X
          </button>
        </div>
      )}
      {loading ? (
        <div className="table-empty">Loading ingestion history...</div>
      ) : pipelines.length === 0 ? (
        !error && <div className="table-empty">No ingestion pipelines yet.</div>
      ) : (
        <div className="history-list">
          {pipelines.map((item) => (
            <button key={item.id} type="button" className="history-row-btn" onClick={() => onOpen(item.id)}>
              <span className="history-row-main">
                <FileText size={16} className="history-row-icon" />
                <span className="history-row-info">
                  <span className="history-row-filename">{item.filename}</span>
                  <span className="history-row-date">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                  </span>
                </span>
              </span>
              <span className="history-row-meta">
                <span className="history-row-chunks">
                  {item.chunk_count} {item.chunk_count === 1 ? 'chunk' : 'chunks'}
                </span>
                <span className={`status-pill ${item.status}`}>{item.status}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
