import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import type { Connection } from '../../types/connections'
import { planLabels, type ConnectionForm } from './types'

type Props = {
  form: ConnectionForm
  editing: string | null
  connections: Connection[]
  busy: boolean
  error: string
  onChange: (changes: Partial<ConnectionForm>) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

export function ConnectionDialog({ form, editing, connections, busy, error, onChange, onClose, onSubmit }: Props) {
  const editingConnection = connections.find(item => item.id === editing)

  return <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><form className="modal connection-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="connection-title"><div className="modal-head"><div><span className="eyebrow">LLM ROUTING</span><h2 id="connection-title">{editing ? 'Edit connection' : 'Add connection'}</h2></div><button type="button" className="icon-button" aria-label="Close form" onClick={onClose}>X</button></div><div className="connection-fields">
    <label className="field-label">Name<input required maxLength={100} value={form.name} onChange={event => onChange({ name: event.target.value })} /></label>
    <label className="field-label">Provider<select value={form.provider} onChange={event => { const provider = event.target.value as ConnectionForm['provider']; onChange({ provider, ...(provider === 'mock' ? { model: 'extractive-simulator' } : {}) }) }}><option value="mock">Simulator</option><option value="openai">OpenAI-compatible</option><option value="azure_openai">Azure OpenAI</option><option value="anthropic">Anthropic</option></select></label>
    <p className="provider-help">{providerHelp(form.provider)}</p>
    <label className="field-label">Model or deployment<input required value={form.model} onChange={event => onChange({ model: event.target.value })} /></label>
    {form.provider !== 'mock' && <label className="field-label">Base URL<input value={form.base_url} onChange={event => onChange({ base_url: event.target.value })} placeholder={form.provider === 'openai' ? 'Leave empty for OpenAI' : form.provider === 'anthropic' ? 'Leave empty for public API' : 'https://resource.openai.azure.com'} /></label>}
    {(form.provider === 'azure_openai' || form.provider === 'anthropic') && <label className="field-label">API version<input value={form.api_version} onChange={event => onChange({ api_version: event.target.value })} placeholder={form.provider === 'azure_openai' ? '2024-10-21' : '2023-06-01'} /></label>}
    {form.provider !== 'mock' && <><label className="field-label">API key<input type="password" value={form.api_key} onChange={event => onChange({ api_key: event.target.value, remove_api_key: false })} placeholder={editing ? (editingConnection?.api_key_hint ? `Leave empty to keep ${editingConnection.api_key_hint}` : 'Enter API key') : 'Enter API key'} autoComplete="new-password" /></label>{editing && editingConnection?.has_api_key && <label className="check-row"><input type="checkbox" checked={form.remove_api_key} onChange={event => onChange({ remove_api_key: event.target.checked, api_key: '' })} /><span>Remove the stored API key</span></label>}</>}
    <div className="number-fields"><label className="field-label">Temperature<input type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={event => onChange({ temperature: Number(event.target.value) })} /></label><label className="field-label">Max tokens<input type="number" min="1" max="16000" value={form.max_tokens} onChange={event => onChange({ max_tokens: Number(event.target.value) })} /></label></div>
    <fieldset className="plan-checks"><legend>Plans served</legend><div>{planLabels.map(plan => <label className="check-row" key={plan.id}><input type="checkbox" checked={form.plans.includes(plan.id)} onChange={event => onChange({ plans: event.target.checked ? [...form.plans, plan.id] : form.plans.filter(item => item !== plan.id) })} /><span>{plan.label}</span></label>)}</div><small>A selected plan moves from its current connection.</small></fieldset>
  </div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}><Check size={15} />{busy ? 'Saving...' : 'Save connection'}</button></div></form></div>
}

function providerHelp(provider: ConnectionForm['provider']) {
  if (provider === 'mock') return 'No network or API key. Uses the built-in extractive simulator.'
  if (provider === 'openai') return 'OpenAI, Mistral, Ollama, vLLM, or LM Studio. Use a compatible chat completions endpoint.'
  if (provider === 'azure_openai') return 'The model field is the deployment name. Supply the resource endpoint and API version.'
  return 'Anthropic Messages API. Leave the base URL empty to use the public API.'
}