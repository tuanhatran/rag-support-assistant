import { useState } from 'react'
import { Check, Copy, FileText, Layers, Share2 } from 'lucide-react'
import type { ChunkPreview, IngestionPipeline } from '../../types/ingestion'
import { createPipelineExportPayload } from './pipelinePayload'

type RightTab = 'chunks' | 'text' | 'export'

interface PipelineDetailsProps {
  pipeline: IngestionPipeline | null
  chunks: ChunkPreview[]
  onError: (message: string) => void
}

export function PipelineDetails({ pipeline, chunks, onError }: PipelineDetailsProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('chunks')
  const [copied, setCopied] = useState(false)
  const exportPayload = createPipelineExportPayload(pipeline, chunks)

  async function copyPayload() {
    if (!pipeline) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(createPipelineExportPayload(pipeline, chunks, true), null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onError('Failed to copy payload to clipboard')
    }
  }

  return (
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
                {chunks.map((chunk) => (
                  <article key={chunk.index} className="chunk-card">
                    <div className="chunk-card-head">
                      <span className="chunk-badge">Chunk #{chunk.index + 1}</span>
                      <span className="chunk-length">{chunk.content.length} chars</span>
                      <span className="chunk-meta-pill">
                        {chunk.model} ({chunk.dimensions}d)
                      </span>
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
              Sensitive keys, credentials, and tokens are automatically redacted via <code>redact()</code> before
              storage.
            </div>
            <pre className="extracted-text-content">{pipeline?.extracted_text || '(No text extracted yet)'}</pre>
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
            <pre className="export-json-content">{JSON.stringify(exportPayload, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
