import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, Cpu, FileText, Layers, Sparkles, Upload, UploadCloud } from 'lucide-react'
import { api } from '../api'
import type { EmbeddingModelOption, IngestionOptions } from '../types'

interface IngestionViewProps {
  onOpenPipeline: (pipelineId: string) => void
}

const MAX_FILE_SIZE = 512_000 // 500 KB

export function IngestionView({ onOpenPipeline }: IngestionViewProps) {
  const [options, setOptions] = useState<IngestionOptions | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)
  const [separator, setSeparator] = useState('\n\n')
  const [embeddingModel, setEmbeddingModel] = useState('@cf/baai/bge-small-en-v1.5')
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submittedPipelineId, setSubmittedPipelineId] = useState<string | null>(null)

  useEffect(() => {
    api.get<IngestionOptions>('/admin/ingestion/options')
      .then(res => {
        setOptions(res)
        if (res.chunk_size?.default) setChunkSize(res.chunk_size.default)
        if (res.chunk_overlap?.default) setChunkOverlap(res.chunk_overlap.default)
        if (res.models?.length > 0 && !res.models.some(m => m.id === embeddingModel)) {
          setEmbeddingModel(res.models[0].id)
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load options'))
  }, [])

  function validateAndSelectFile(selected: File | null) {
    setError('')
    setSubmittedPipelineId(null)
    if (!selected) {
      setFile(null)
      return
    }
    const name = selected.name.toLowerCase()
    if (!name.endsWith('.txt') && !name.endsWith('.pdf')) {
      setError('Unsupported file type. Only .txt and .pdf files are accepted.')
      setFile(null)
      return
    }
    if (selected.size === 0) {
      setError('Uploaded file cannot be empty.')
      setFile(null)
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('File exceeds maximum allowed size of 500 KB (512,000 bytes).')
      setFile(null)
      return
    }
    setFile(selected)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFile(e.dataTransfer.files[0])
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFile(e.target.files[0])
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setError('')
    setSubmitting(true)
    setSubmittedPipelineId(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('chunk_size', String(chunkSize))
      formData.append('chunk_overlap', String(chunkOverlap))
      formData.append('separator', separator)
      formData.append('embedding_model', embeddingModel)

      const result = await api.postForm<{ id: string; status: string }>(
        '/admin/ingestion/pipelines',
        formData
      )
      setSubmittedPipelineId(result.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ingestion pipeline')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedModel: EmbeddingModelOption | undefined = options?.models?.find(m => m.id === embeddingModel)

  return (
    <section className="admin-section ingestion-view">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">DOCUMENT INGESTION &amp; EMBEDDING</span>
          <h2>Document Ingestion Pipeline</h2>
          <p>Upload documentation to parse, redact sensitive data, chunk, embed, and store vectors in PostgreSQL pgvector.</p>
        </div>
      </div>

      {error && (
        <div className="form-error page-alert">
          {error}
          <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>X</button>
        </div>
      )}

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

      <form onSubmit={handleSubmit} className="ingestion-form">
        <div className="ingestion-grid">
          {/* Upload Zone */}
          <div className="ingestion-col">
            <label className="field-label">Document File</label>
            <div
              className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="document-upload"
                accept=".txt,.pdf"
                className="sr-only"
                onChange={handleFileChange}
              />
              <UploadCloud size={36} className="upload-icon" />
              {file ? (
                <div className="file-preview-card">
                  <FileText size={20} />
                  <div className="file-meta">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <label htmlFor="document-upload" className="button button-subtle">
                    Change
                  </label>
                </div>
              ) : (
                <div className="upload-prompt">
                  <p>Drag and drop your document here, or</p>
                  <label htmlFor="document-upload" className="button button-secondary">
                    <Upload size={14} /> Browse file
                  </label>
                  <small className="upload-hint">Accepted formats: .txt, .pdf (Max size 500 KB / 512,000 bytes)</small>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Options */}
          <div className="ingestion-col">
            <div className="options-card">
              <div className="options-header">
                <Layers size={16} />
                <b>Chunking &amp; Model Options</b>
              </div>

              <div className="option-row">
                <div className="field-label">
                  Chunk Size
                  <small className="field-hint">(100 - 2000 chars)</small>
                </div>
                <input
                  type="number"
                  min={options?.chunk_size?.min ?? 100}
                  max={options?.chunk_size?.max ?? 2000}
                  value={chunkSize}
                  onChange={e => setChunkSize(Number(e.target.value))}
                  required
                />
              </div>

              <div className="option-row">
                <div className="field-label">
                  Chunk Overlap
                  <small className="field-hint">(&ge; 0 and &lt; chunk size)</small>
                </div>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, chunkSize - 1)}
                  value={chunkOverlap}
                  onChange={e => setChunkOverlap(Number(e.target.value))}
                  required
                />
              </div>

              <div className="option-row">
                <div className="field-label">Separator</div>
                <div className="select-wrap">
                  <select value={separator} onChange={e => setSeparator(e.target.value)}>
                    {(options?.separators || [
                      { value: '\n\n', label: 'Paragraphs (\\n\\n)' },
                      { value: '\n', label: 'Lines (\\n)' },
                      { value: ' ', label: 'Spaces ( )' },
                    ]).map(sep => (
                      <option key={sep.value} value={sep.value}>{sep.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>

              <div className="option-row">
                <div className="field-label">Embedding Model</div>
                <div className="select-wrap">
                  <select value={embeddingModel} onChange={e => setEmbeddingModel(e.target.value)}>
                    {options?.models?.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>

              {selectedModel && (
                <div className="model-info-badge">
                  <div className="model-info-item">
                    <Cpu size={14} />
                    <span><b>Target:</b> {selectedModel.target}</span>
                  </div>
                  <div className="model-info-item">
                    <Sparkles size={14} />
                    <span><b>Dimensions:</b> {selectedModel.dimensions}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ingestion-actions">
          <button
            type="submit"
            className="button button-primary submit-ingestion-btn"
            disabled={!file || submitting}
          >
            {submitting ? 'Starting pipeline...' : 'Process & Ingest Document'}
          </button>
        </div>
      </form>
    </section>
  )
}
