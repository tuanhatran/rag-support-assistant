import { CheckCircle2, Clock, Cpu, Database, FileSearch, FileText, Layers, Loader2, XCircle } from 'lucide-react'
import type { IngestionPipeline, StageInfo, StageStatus } from '../../types/ingestion'

const stages: { key: keyof IngestionPipeline['stages']; label: string; icon: typeof FileText }[] = [
  { key: 'file_parsing', label: 'File Parsing', icon: FileSearch },
  { key: 'chunking', label: 'Chunking', icon: Layers },
  { key: 'embedding', label: 'Embedding', icon: Cpu },
  { key: 'database_ready', label: 'Database Ready', icon: Database },
]

export function PipelineStages({ pipeline }: { pipeline: IngestionPipeline | null }) {
  return <div className="stage-cards-grid">{stages.map((stage, index) => {
    const info: StageInfo = pipeline?.stages?.[stage.key] || { status: 'idle', latency_ms: 0 }
    return <div key={stage.key} className={`stage-card ${info.status}`}>
      <div className="stage-card-step">Stage 0{index + 1}</div>
      <div className="stage-card-body"><div className="stage-card-title"><stage.icon size={18} /><b>{stage.label}</b></div><div className="stage-card-meta"><span className={`stage-status-indicator ${info.status}`}>{renderStatusIcon(info.status)}{info.status}</span><span className="stage-latency"><Clock size={12} /> {info.latency_ms} ms</span></div></div>
    </div>
  })}</div>
}

function renderStatusIcon(status: StageStatus) {
  switch (status) {
    case 'running': return <Loader2 size={13} className="spin" />
    case 'done': return <CheckCircle2 size={13} />
    case 'failed': return <XCircle size={13} />
    default: return <Clock size={13} />
  }
}