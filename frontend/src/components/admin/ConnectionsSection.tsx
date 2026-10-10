import { CircleAlert, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { Connection } from '../../types/connections'
import type { Plan } from '../../types/account'

type Props = {
  connections: Connection[]
  missingPlans: { id: Plan; label: string }[]
  onAdd: () => void
  onEdit: (connection: Connection) => void
  onTest: (connection: Connection) => void
  onDelete: (connection: Connection) => void
}

export function ConnectionsSection({ connections, missingPlans, onAdd, onEdit, onTest, onDelete }: Props) {
  return <section className="admin-section">
    <div className="section-toolbar"><div><span className="eyebrow">MODEL ROUTING</span><h2>Connections</h2><p>Each plan is served by one active connection.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={16} />Add connection</button></div>
    {missingPlans.length > 0 && <div className="warning-banner"><CircleAlert size={17} /><span><b>Model assignment needed</b><small>{missingPlans.map(item => item.label).join(', ')} {missingPlans.length === 1 ? 'has' : 'have'} no model assigned. Questions on those plans will be unavailable.</small></span></div>}
    <div className="table-wrap"><table><thead><tr><th>Connection</th><th>Provider / model</th><th>Endpoint</th><th>API key</th><th>Plans</th><th>Actions</th></tr></thead><tbody>{connections.map(connection => <tr key={connection.id}><td><b className="table-primary">{connection.name}</b><small className="table-sub">{connection.provider === 'mock' ? 'Built-in simulator' : connection.provider.replace('_', ' ')}</small></td><td><b>{connection.model}</b><small className="table-sub">{connection.provider}</small></td><td className="endpoint-cell">{connection.base_url || (connection.provider === 'openai' ? 'api.openai.com' : '-')}</td><td>{connection.has_api_key ? <span className="key-hint">{connection.api_key_hint}</span> : <span className="muted">No key</span>}</td><td><div className="plan-badges">{connection.plans.map(item => <span className={`plan-badge ${item}`} key={item}>{item}</span>)}</div></td><td><div className="table-actions"><button className="icon-button" title="Test connection" aria-label={`Test ${connection.name}`} onClick={() => onTest(connection)}><RefreshCw size={15} /></button><button className="icon-button" title="Edit connection" aria-label={`Edit ${connection.name}`} onClick={() => onEdit(connection)}><Pencil size={15} /></button><button className="icon-button danger-icon" title="Delete connection" aria-label={`Delete ${connection.name}`} disabled={connection.plans.length > 0} onClick={() => onDelete(connection)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{connections.length === 0 && <div className="table-empty">No model connections configured.</div>}</div>
  </section>
}