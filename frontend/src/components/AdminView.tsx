import { FormEvent, useEffect, useState } from 'react'
import { Activity, Check, ChevronDown, CircleAlert, ClipboardList, Pencil, Plus, RefreshCw, ServerCog, ShieldCheck, Trash2, Users } from 'lucide-react'
import { api } from '../api'
import type { Connection, Plan } from '../types'

type AdminTab = 'connections' | 'users' | 'feedback' | 'audit'
type AdminUser = { id: string; username: string; role: 'user' | 'admin'; plan: Plan; created_at?: string }
type Feedback = { session_id: string; message_id: string; username: string; rating: 'up' | 'down'; categories: string[]; comment: string; question: string; answer: string; model: { model: string }; created_at: string }
type AuditEntry = { timestamp: string; event: string; outcome: string; actor?: { username: string }; target?: Record<string, string>; details?: Record<string, string>; request_id?: string }
type ConnectionForm = Omit<Connection, 'id' | 'api_key_hint' | 'has_api_key'> & { api_key: string; remove_api_key: boolean }

const blankConnection: ConnectionForm = { name: '', provider: 'mock', model: 'extractive-simulator', base_url: '', api_version: '', api_key: '', remove_api_key: false, temperature: 0, max_tokens: 1200, plans: ['basic', 'standard', 'premium'] }
const planLabels: { id: Plan; label: string }[] = [{ id: 'basic', label: 'Basic' }, { id: 'standard', label: 'Standard' }, { id: 'premium', label: 'Premium' }]

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('connections')
  const [connections, setConnections] = useState<Connection[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [stats, setStats] = useState({ total: 0, helpful: 0, not_helpful: 0, satisfaction_percent: 0 })
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [rating, setRating] = useState('')
  const [filters, setFilters] = useState({ event: '', outcome: '', username: '' })
  const [form, setForm] = useState<ConnectionForm>(blankConnection)
  const [editing, setEditing] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadConnections() { setConnections(await api.get<Connection[]>('/admin/connections')) }
  async function loadUsers() { setUsers(await api.get<AdminUser[]>('/admin/users')) }
  async function loadFeedback() {
    const query = rating ? `?rating=${rating}` : ''
    const [rows, summary] = await Promise.all([api.get<Feedback[]>(`/admin/feedback${query}`), api.get<typeof stats>('/admin/feedback/stats')])
    setFeedback(rows); setStats(summary)
  }
  async function loadAudit() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim()))
    setAudit(await api.get<AuditEntry[]>(`/admin/audit?${params}`))
  }

  useEffect(() => { loadConnections().catch(fail) }, [])
  useEffect(() => { if (tab === 'users') loadUsers().catch(fail); if (tab === 'feedback') loadFeedback().catch(fail); if (tab === 'audit') loadAudit().catch(fail) }, [tab, rating])

  function fail(reason: unknown) { setError(reason instanceof Error ? reason.message : 'The request failed.') }
  function startCreate() { setEditing(null); setForm({ ...blankConnection }); setFormOpen(true); setError('') }
  function startEdit(connection: Connection) {
    setEditing(connection.id)
    setForm({ name: connection.name, provider: connection.provider, model: connection.model, base_url: connection.base_url,
      api_version: connection.api_version, api_key: '', remove_api_key: false, temperature: connection.temperature,
      max_tokens: connection.max_tokens, plans: connection.plans })
    setFormOpen(true); setError('')
  }

  async function saveConnection(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const payload = { ...form, api_key: form.remove_api_key ? '***' : form.api_key }
      if (editing) await api.patch(`/admin/connections/${editing}`, payload)
      else await api.post('/admin/connections', payload)
      setFormOpen(false); setNotice(editing ? 'Connection updated.' : 'Connection created.'); await loadConnections()
    } catch (reason) { fail(reason) } finally { setBusy(false) }
  }

  async function testConnection(connection: Connection) {
    setError(''); setNotice('Testing connection...')
    try { const result = await api.post<{ ok: boolean; message: string }>(`/admin/connections/${connection.id}/test`); setNotice(result.message) }
    catch (reason) { fail(reason) }
  }

  async function deleteConnection(connection: Connection) {
    if (!window.confirm(`Delete ${connection.name}?`)) return
    try { await api.delete(`/admin/connections/${connection.id}`); setNotice('Connection deleted.'); await loadConnections() }
    catch (reason) { fail(reason) }
  }

  async function updateUser(user: AdminUser, changes: { role?: AdminUser['role']; plan?: Plan }) {
    try { await api.patch(`/admin/users/${user.id}`, changes); setNotice(`Updated ${user.username}.`); await loadUsers() }
    catch (reason) { fail(reason) }
  }

  async function submitAudit(event: FormEvent) { event.preventDefault(); try { await loadAudit() } catch (reason) { fail(reason) } }

  const nav: { id: AdminTab; label: string; icon: typeof ServerCog }[] = [
    { id: 'connections', label: 'LLM connections', icon: ServerCog }, { id: 'users', label: 'Users', icon: Users },
    { id: 'feedback', label: 'Chat feedback', icon: Activity }, { id: 'audit', label: 'Audit log', icon: ClipboardList },
  ]
  const missingPlans = planLabels.filter(plan => !connections.some(connection => connection.plans.includes(plan.id)))

  return <div className="content-page admin-page">
    <div className="page-heading"><div><span className="eyebrow">CONTROL ROOM / ADMINISTRATION</span><h1>Admin console</h1><p>Manage model routing, user access, answer quality, and security events.</p></div><div className="admin-seal"><ShieldCheck size={20} /><span>PRIVILEGED<br /><b>ACCESS</b></span></div></div>
    {(error || notice) && <div className={error ? 'form-error page-alert' : 'inline-success page-alert'}>{error || notice}<button className="icon-button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }}>X</button></div>}
    <div className="admin-tabs" role="tablist">{nav.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}><item.icon size={16} />{item.label}{item.id === 'connections' && missingPlans.length > 0 && <span className="tab-warning">{missingPlans.length}</span>}</button>)}</div>

    {tab === 'connections' && <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">MODEL ROUTING</span><h2>Connections</h2><p>Each plan is served by one active connection.</p></div><button className="button button-primary" onClick={startCreate}><Plus size={16} />Add connection</button></div>
      {missingPlans.length > 0 && <div className="warning-banner"><CircleAlert size={17} /><span><b>Model assignment needed</b><small>{missingPlans.map(item => item.label).join(', ')} {missingPlans.length === 1 ? 'has' : 'have'} no model assigned. Questions on those plans will be unavailable.</small></span></div>}
      <div className="table-wrap"><table><thead><tr><th>Connection</th><th>Provider / model</th><th>Endpoint</th><th>API key</th><th>Plans</th><th>Actions</th></tr></thead><tbody>{connections.map(connection => <tr key={connection.id}><td><b className="table-primary">{connection.name}</b><small className="table-sub">{connection.provider === 'mock' ? 'Built-in simulator' : connection.provider.replace('_', ' ')}</small></td><td><b>{connection.model}</b><small className="table-sub">{connection.provider}</small></td><td className="endpoint-cell">{connection.base_url || (connection.provider === 'openai' ? 'api.openai.com' : '-')}</td><td>{connection.has_api_key ? <span className="key-hint">{connection.api_key_hint}</span> : <span className="muted">No key</span>}</td><td><div className="plan-badges">{connection.plans.map(item => <span className={`plan-badge ${item}`} key={item}>{item}</span>)}</div></td><td><div className="table-actions"><button className="icon-button" title="Test connection" aria-label={`Test ${connection.name}`} onClick={() => testConnection(connection)}><RefreshCw size={15} /></button><button className="icon-button" title="Edit connection" aria-label={`Edit ${connection.name}`} onClick={() => startEdit(connection)}><Pencil size={15} /></button><button className="icon-button danger-icon" title="Delete connection" aria-label={`Delete ${connection.name}`} disabled={connection.plans.length > 0} onClick={() => deleteConnection(connection)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{connections.length === 0 && <div className="table-empty">No model connections configured.</div>}</div>
    </section>}

    {tab === 'users' && <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">IDENTITY &amp; ACCESS</span><h2>User accounts</h2><p>Change a user's support plan or role. The last admin cannot be demoted.</p></div><span className="count-pill">{users.length} accounts</span></div><div className="table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Plan</th><th>Created</th><th>Model assignment</th></tr></thead><tbody>{users.map(user => { const assigned = connections.find(connection => connection.plans.includes(user.plan)); return <tr key={user.id}><td><b className="table-primary">{user.username}</b>{user.role === 'admin' && <span className="admin-user-label">ADMIN</span>}</td><td><label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.username}</label><select id={`role-${user.id}`} className="table-select" value={user.role} onChange={event => updateUser(user, { role: event.target.value as AdminUser['role'] })}><option value="user">User</option><option value="admin">Admin</option></select></td><td><label className="sr-only" htmlFor={`plan-${user.id}`}>Plan for {user.username}</label><select id={`plan-${user.id}`} className="table-select" value={user.plan} onChange={event => updateUser(user, { plan: event.target.value as Plan })}>{planLabels.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></td><td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td><td>{assigned ? <span>{assigned.model}</span> : <span className="missing-model">No model assigned</span>}</td></tr> })}</tbody></table></div></section>}

    {tab === 'feedback' && <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">ANSWER QUALITY</span><h2>Chat feedback</h2><p>Review ratings and user comments on generated answers.</p></div><label className="select-wrap compact-select"><span>Rating</span><select value={rating} onChange={event => setRating(event.target.value)}><option value="">All ratings</option><option value="up">Helpful</option><option value="down">Not helpful</option></select><ChevronDown size={14} /></label></div><div className="stats-strip">{[['TOTAL RATINGS', stats.total], ['HELPFUL', stats.helpful], ['NOT HELPFUL', stats.not_helpful], ['SATISFACTION', `${stats.satisfaction_percent}%`]].map(([label, value]) => <div className="stat-cell" key={label}><span>{label}</span><b>{value}</b></div>)}</div><div className="feedback-cards">{feedback.map(item => <article className="feedback-card" key={`${item.session_id}-${item.message_id}`}><div className="feedback-card-head"><span className={`rating-pill ${item.rating}`}>{item.rating === 'up' ? 'Helpful' : 'Not helpful'}</span><span>{item.username}</span><span>{new Date(item.created_at).toLocaleString()}</span><span className="feedback-model">{item.model?.model}</span></div><div className="feedback-exchange"><b>Question</b><p>{item.question}</p><b>Answer</b><p>{item.answer}</p></div>{item.categories.length > 0 && <div className="feedback-category-row">{item.categories.map(value => <span className="feedback-category" key={value}>{value.replace('_', ' ')}</span>)}</div>}{item.comment && <blockquote>{item.comment}</blockquote>}</article>)}{feedback.length === 0 && <div className="table-empty">No feedback matches this filter.</div>}</div></section>}

    {tab === 'audit' && <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">SECURITY EVENTS</span><h2>Audit log</h2><p>Search authentication, privacy, and administrator activity.</p></div><span className="count-pill">{audit.length} events</span></div><form className="audit-filters" onSubmit={submitAudit}><label>Event<input value={filters.event} onChange={event => setFilters({ ...filters, event: event.target.value })} placeholder="e.g. auth.login" /></label><label>Outcome<select value={filters.outcome} onChange={event => setFilters({ ...filters, outcome: event.target.value })}><option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select></label><label>Username<input value={filters.username} onChange={event => setFilters({ ...filters, username: event.target.value })} placeholder="Filter actor" /></label><button className="button button-primary"><RefreshCw size={15} />Apply filters</button></form><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Event</th><th>Outcome</th><th>Actor</th><th>Details</th><th>Request ID</th></tr></thead><tbody>{audit.map((entry, index) => <tr key={`${entry.timestamp}-${index}`}><td>{new Date(entry.timestamp).toLocaleString()}</td><td><code>{entry.event}</code></td><td><span className={`outcome ${entry.outcome}`}>{entry.outcome}</span></td><td>{entry.actor?.username ?? 'System'}</td><td>{entry.details ? Object.entries(entry.details).map(([key, value]) => `${key}: ${value}`).join(' / ') : '-'}</td><td><code className="request-id">{entry.request_id ?? '-'}</code></td></tr>)}</tbody></table>{audit.length === 0 && <div className="table-empty">No audit events match these filters.</div>}</div></section>}

    {formOpen && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false) }}><form className="modal connection-modal" onSubmit={saveConnection} role="dialog" aria-modal="true" aria-labelledby="connection-title"><div className="modal-head"><div><span className="eyebrow">LLM ROUTING</span><h2 id="connection-title">{editing ? 'Edit connection' : 'Add connection'}</h2></div><button type="button" className="icon-button" aria-label="Close form" onClick={() => setFormOpen(false)}>X</button></div><div className="connection-fields">
      <label className="field-label">Name<input required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label className="field-label">Provider<select value={form.provider} onChange={event => setForm({ ...form, provider: event.target.value as ConnectionForm['provider'], model: event.target.value === 'mock' ? 'extractive-simulator' : form.model })}><option value="mock">Simulator</option><option value="openai">OpenAI-compatible</option><option value="azure_openai">Azure OpenAI</option><option value="anthropic">Anthropic</option></select></label>
      <p className="provider-help">{providerHelp(form.provider)}</p>
      <label className="field-label">Model or deployment<input required value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} /></label>
      {form.provider !== 'mock' && <label className="field-label">Base URL<input value={form.base_url} onChange={event => setForm({ ...form, base_url: event.target.value })} placeholder={form.provider === 'openai' ? 'Leave empty for OpenAI' : form.provider === 'anthropic' ? 'Leave empty for public API' : 'https://resource.openai.azure.com'} /></label>}
      {(form.provider === 'azure_openai' || form.provider === 'anthropic') && <label className="field-label">API version<input value={form.api_version} onChange={event => setForm({ ...form, api_version: event.target.value })} placeholder={form.provider === 'azure_openai' ? '2024-10-21' : '2023-06-01'} /></label>}
      {form.provider !== 'mock' && <><label className="field-label">API key<input type="password" value={form.api_key} onChange={event => setForm({ ...form, api_key: event.target.value, remove_api_key: false })} placeholder={editing ? (connections.find(item => item.id === editing)?.api_key_hint ? `Leave empty to keep ${connections.find(item => item.id === editing)?.api_key_hint}` : 'Enter API key') : 'Enter API key'} autoComplete="new-password" /></label>{editing && connections.find(item => item.id === editing)?.has_api_key && <label className="check-row"><input type="checkbox" checked={form.remove_api_key} onChange={event => setForm({ ...form, remove_api_key: event.target.checked, api_key: '' })} /><span>Remove the stored API key</span></label>}</>}
      <div className="number-fields"><label className="field-label">Temperature<input type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={event => setForm({ ...form, temperature: Number(event.target.value) })} /></label><label className="field-label">Max tokens<input type="number" min="1" max="16000" value={form.max_tokens} onChange={event => setForm({ ...form, max_tokens: Number(event.target.value) })} /></label></div>
      <fieldset className="plan-checks"><legend>Plans served</legend><div>{planLabels.map(plan => <label className="check-row" key={plan.id}><input type="checkbox" checked={form.plans.includes(plan.id)} onChange={event => setForm({ ...form, plans: event.target.checked ? [...form.plans, plan.id] : form.plans.filter(item => item !== plan.id) })} /><span>{plan.label}</span></label>)}</div><small>A selected plan moves from its current connection.</small></fieldset>
    </div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy}><Check size={15} />{busy ? 'Saving...' : 'Save connection'}</button></div></form></div>}
  </div>
}

function providerHelp(provider: ConnectionForm['provider']) {
  if (provider === 'mock') return 'No network or API key. Uses the built-in extractive simulator.'
  if (provider === 'openai') return 'OpenAI, Mistral, Ollama, vLLM, or LM Studio. Use a compatible chat completions endpoint.'
  if (provider === 'azure_openai') return 'The model field is the deployment name. Supply the resource endpoint and API version.'
  return 'Anthropic Messages API. Leave the base URL empty to use the public API.'
}