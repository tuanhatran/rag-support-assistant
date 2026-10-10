import { useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { ChevronDown, Cpu, FileText, Layers, Sparkles, Upload, UploadCloud } from 'lucide-react'
import type { EmbeddingModelOption, IngestionOptions } from '../../types/ingestion'

const MAX_FILE_SIZE = 512_000

export interface IngestionSettings {
  chunkSize: number
  chunkOverlap: number
  separator: string
  embeddingModel: string
}

interface IngestionFormProps {
  options: IngestionOptions | null
  submitting: boolean
  error: string
  onError: (message: string) => void
  onSelectionChange: () => void
  onSubmit: (file: File, settings: IngestionSettings) => void
}

export function IngestionForm({
  options,
  submitting,
  error,
  onError,
  onSelectionChange,
  onSubmit,
}: IngestionFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)
  const [separator, setSeparator] = useState('\n\n')
  const [embeddingModel, setEmbeddingModel] = useState('@cf/baai/bge-small-en-v1.5')
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (options?.chunk_size?.default) setChunkSize(options.chunk_size.default)
    if (options?.chunk_overlap?.default) setChunkOverlap(options.chunk_overlap.default)
    if (options?.models.length && !options.models.some((model) => model.id === embeddingModel)) {
      setEmbeddingModel(options.models[0].id)
    }
  }, [options])

  function validateAndSelectFile(selected: File | null) {
    onError('')
    onSelectionChange()
    if (!selected) {
      setFile(null)
      return
    }
    const name = selected.name.toLowerCase()
    if (!name.endsWith('.txt') && !name.endsWith('.pdf')) {
      onError('Unsupported file type. Only .txt and .pdf files are accepted.')
      setFile(null)
      return
    }
    if (selected.size === 0) {
      onError('Uploaded file cannot be empty.')
      setFile(null)
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      onError('File exceeds maximum allowed size of 500 KB (512,000 bytes).')
      setFile(null)
      return
    }
    setFile(selected)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) validateAndSelectFile(event.dataTransfer.files[0])
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) validateAndSelectFile(event.target.files[0])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (file) onSubmit(file, { chunkSize, chunkOverlap, separator, embeddingModel })
  }

  const selectedModel: EmbeddingModelOption | undefined = options?.models.find((model) => model.id === embeddingModel)

  return (
    <>
      {error && (
        <div className="form-error page-alert">
          {error}
          <button className="icon-button" aria-label="Dismiss error" onClick={() => onError('')}>
            X
          </button>
        </div>
      )}
      <form onSubmit={submit} className="ingestion-form">
        <div className="ingestion-grid">
          <div className="ingestion-col">
            <label className="field-label">Document File</label>
            <div
              className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
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
          <div className="ingestion-col">
            <div className="options-card">
              <div className="options-header">
                <Layers size={16} />
                <b>Chunking &amp; Model Options</b>
              </div>
              <div className="option-row">
                <div className="field-label">
                  Chunk Size<small className="field-hint">(100 - 2000 chars)</small>
                </div>
                <input
                  type="number"
                  min={options?.chunk_size?.min ?? 100}
                  max={options?.chunk_size?.max ?? 2000}
                  value={chunkSize}
                  onChange={(event) => setChunkSize(Number(event.target.value))}
                  required
                />
              </div>
              <div className="option-row">
                <div className="field-label">
                  Chunk Overlap<small className="field-hint">(&ge; 0 and &lt; chunk size)</small>
                </div>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, chunkSize - 1)}
                  value={chunkOverlap}
                  onChange={(event) => setChunkOverlap(Number(event.target.value))}
                  required
                />
              </div>
              <div className="option-row">
                <div className="field-label">Separator</div>
                <div className="select-wrap">
                  <select value={separator} onChange={(event) => setSeparator(event.target.value)}>
                    {(
                      options?.separators || [
                        { value: '\n\n', label: 'Paragraphs (\\n\\n)' },
                        { value: '\n', label: 'Lines (\\n)' },
                        { value: ' ', label: 'Spaces ( )' },
                      ]
                    ).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
              <div className="option-row">
                <div className="field-label">Embedding Model</div>
                <div className="select-wrap">
                  <select value={embeddingModel} onChange={(event) => setEmbeddingModel(event.target.value)}>
                    {options?.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
              {selectedModel && (
                <div className="model-info-badge">
                  <div className="model-info-item">
                    <Cpu size={14} />
                    <span>
                      <b>Target:</b> {selectedModel.target}
                    </span>
                  </div>
                  <div className="model-info-item">
                    <Sparkles size={14} />
                    <span>
                      <b>Dimensions:</b> {selectedModel.dimensions}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="ingestion-actions">
          <button type="submit" className="button button-primary submit-ingestion-btn" disabled={!file || submitting}>
            {submitting ? 'Starting pipeline...' : 'Process & Ingest Document'}
          </button>
        </div>
      </form>
    </>
  )
}
