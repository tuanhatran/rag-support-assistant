import { FormEvent, useEffect, useRef, useState } from 'react'
import { Activity, ClipboardList, ServerCog, ShieldCheck, UploadCloud, Users } from 'lucide-react'
import * as adminApi from '../api/admin'
import type { Connection } from '../types/connections'
import type { Plan } from '../types/account'
import { IngestionView } from './IngestionView'
import { IngestionPipelineView } from './IngestionPipelineView'
import { AuditSection } from './admin/AuditSection'
import { ConnectionDialog } from './admin/ConnectionDialog'
import { ConnectionsSection } from './admin/ConnectionsSection'
import { FeedbackSection } from './admin/FeedbackSection'
import { UsersSection } from './admin/UsersSection'
import {
  blankConnection,
  planLabels,
  type AdminTab,
  type AdminUser,
  type AuditEntry,
  type AuditFilters,
  type ConnectionForm,
  type Feedback,
  type FeedbackStats,
  type UserEdit,
} from './admin/types'

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('connections')
  const [connections, setConnections] = useState<Connection[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userEdits, setUserEdits] = useState<Record<string, UserEdit>>({})
  const [savingUsers, setSavingUsers] = useState<Set<string>>(() => new Set())
  const savingUserIds = useRef(new Set<string>())
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [stats, setStats] = useState<FeedbackStats>({ total: 0, helpful: 0, not_helpful: 0, satisfaction_percent: 0 })
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [rating, setRating] = useState('')
  const [filters, setFilters] = useState<AuditFilters>({ event: '', outcome: '', username: '' })
  const [form, setForm] = useState<ConnectionForm>(blankConnection)
  const [editing, setEditing] = useState<string | null>(null)
  const [viewingPipelineId, setViewingPipelineId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadConnections() {
    setConnections(await adminApi.listConnections())
  }
  async function loadUsers() {
    setUsers(await adminApi.listUsers())
  }
  async function loadFeedback() {
    const [rows, summary] = await Promise.all([adminApi.listFeedback(rating), adminApi.getFeedbackStats()])
    setFeedback(rows)
    setStats(summary)
  }
  async function loadAudit() {
    setAudit(await adminApi.listAudit(filters))
  }

  useEffect(() => {
    loadConnections().catch(fail)
  }, [])
  useEffect(() => {
    if (tab === 'users') loadUsers().catch(fail)
    if (tab === 'feedback') loadFeedback().catch(fail)
    if (tab === 'audit') loadAudit().catch(fail)
  }, [tab, rating])

  function fail(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'The request failed.')
  }
  function startCreate() {
    setEditing(null)
    setForm({ ...blankConnection })
    setFormOpen(true)
    setError('')
  }
  function startEdit(connection: Connection) {
    setEditing(connection.id)
    setForm({
      name: connection.name,
      provider: connection.provider,
      model: connection.model,
      base_url: connection.base_url,
      api_version: connection.api_version,
      api_key: '',
      remove_api_key: false,
      temperature: connection.temperature,
      max_tokens: connection.max_tokens,
      plans: connection.plans,
    })
    setFormOpen(true)
    setError('')
  }

  async function saveConnection(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...form, api_key: form.remove_api_key ? '***' : form.api_key }
      await adminApi.saveConnection(editing, payload)
      setFormOpen(false)
      setNotice(editing ? 'Connection updated.' : 'Connection created.')
      await loadConnections()
    } catch (reason) {
      fail(reason)
    } finally {
      setBusy(false)
    }
  }

  async function testConnection(connection: Connection) {
    setError('')
    setNotice('Testing connection...')
    try {
      const result = await adminApi.testConnection(connection.id)
      setNotice(result.message)
    } catch (reason) {
      fail(reason)
    }
  }

  async function deleteConnection(connection: Connection) {
    if (!window.confirm(`Delete ${connection.name}?`)) return
    try {
      await adminApi.deleteConnection(connection.id)
      setNotice('Connection deleted.')
      await loadConnections()
    } catch (reason) {
      fail(reason)
    }
  }

  async function updateUser(user: AdminUser, changes: { role?: AdminUser['role']; plan?: Plan }): Promise<boolean> {
    try {
      await adminApi.updateUser(user.id, changes)
      setNotice(`Updated ${user.username}.`)
      await loadUsers()
      return true
    } catch (reason) {
      fail(reason)
      return false
    }
  }

  function startUserEdit(user: AdminUser) {
    if (savingUserIds.current.has(user.id)) return
    setUserEdits((current) => ({ ...current, [user.id]: { role: user.role, plan: user.plan } }))
    setError('')
    setNotice('')
  }

  function cancelUserEdit(user: AdminUser) {
    if (savingUserIds.current.has(user.id)) return
    setUserEdits((current) => {
      const next = { ...current }
      delete next[user.id]
      return next
    })
  }

  function stageUserEdit(user: AdminUser, field: keyof UserEdit, value: UserEdit[keyof UserEdit]) {
    if (savingUserIds.current.has(user.id)) return
    setUserEdits((current) => ({ ...current, [user.id]: { ...current[user.id], [field]: value } }))
  }

  async function confirmUserEdit(user: AdminUser) {
    if (savingUserIds.current.has(user.id)) return
    const staged = userEdits[user.id]
    if (!staged || (staged.role === user.role && staged.plan === user.plan)) return
    const changes: Partial<UserEdit> = {}
    if (staged.role !== user.role) changes.role = staged.role
    if (staged.plan !== user.plan) changes.plan = staged.plan
    savingUserIds.current.add(user.id)
    setSavingUsers((current) => new Set(current).add(user.id))
    try {
      if (await updateUser(user, changes)) {
        setUserEdits((current) => {
          const next = { ...current }
          delete next[user.id]
          return next
        })
      }
    } finally {
      savingUserIds.current.delete(user.id)
      setSavingUsers((current) => {
        const next = new Set(current)
        next.delete(user.id)
        return next
      })
    }
  }

  async function submitAudit(event: FormEvent) {
    event.preventDefault()
    try {
      await loadAudit()
    } catch (reason) {
      fail(reason)
    }
  }

  const nav: { id: AdminTab; label: string; icon: typeof ServerCog }[] = [
    { id: 'connections', label: 'LLM connections', icon: ServerCog },
    { id: 'ingestion', label: 'Ingestion', icon: UploadCloud },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'feedback', label: 'Chat feedback', icon: Activity },
    { id: 'audit', label: 'Audit log', icon: ClipboardList },
  ]
  const missingPlans = planLabels.filter(
    (plan) => !connections.some((connection) => connection.plans.includes(plan.id)),
  )

  return (
    <div className="content-page admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONTROL ROOM / ADMINISTRATION</span>
          <h1>Admin console</h1>
          <p>Manage model routing, user access, answer quality, and security events.</p>
        </div>
        <div className="admin-seal">
          <ShieldCheck size={20} />
          <span>
            PRIVILEGED
            <br />
            <b>ACCESS</b>
          </span>
        </div>
      </div>
      {(error || notice) && (
        <div className={error ? 'form-error page-alert' : 'inline-success page-alert'}>
          {error || notice}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => {
              setError('')
              setNotice('')
            }}
          >
            X
          </button>
        </div>
      )}
      <div className="admin-tabs" role="tablist">
        {nav.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'selected' : ''}
            onClick={() => {
              setTab(item.id)
              if (item.id !== 'ingestion') setViewingPipelineId(null)
            }}
          >
            <item.icon size={16} />
            {item.label}
            {item.id === 'connections' && missingPlans.length > 0 && (
              <span className="tab-warning">{missingPlans.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'connections' && (
        <ConnectionsSection
          connections={connections}
          missingPlans={missingPlans}
          onAdd={startCreate}
          onEdit={startEdit}
          onTest={testConnection}
          onDelete={deleteConnection}
        />
      )}

      {tab === 'ingestion' &&
        (viewingPipelineId ? (
          <IngestionPipelineView pipelineId={viewingPipelineId} onBack={() => setViewingPipelineId(null)} />
        ) : (
          <IngestionView onOpenPipeline={(id) => setViewingPipelineId(id)} />
        ))}

      {tab === 'users' && (
        <UsersSection
          users={users}
          connections={connections}
          userEdits={userEdits}
          savingUsers={savingUsers}
          onStartEdit={startUserEdit}
          onCancelEdit={cancelUserEdit}
          onStageEdit={stageUserEdit}
          onConfirmEdit={confirmUserEdit}
        />
      )}

      {tab === 'feedback' && (
        <FeedbackSection feedback={feedback} stats={stats} rating={rating} onRatingChange={setRating} />
      )}

      {tab === 'audit' && (
        <AuditSection audit={audit} filters={filters} onFiltersChange={setFilters} onSubmit={submitAudit} />
      )}

      {formOpen && (
        <ConnectionDialog
          form={form}
          editing={editing}
          connections={connections}
          busy={busy}
          error={error}
          onChange={(changes) => setForm((current) => ({ ...current, ...changes }))}
          onClose={() => setFormOpen(false)}
          onSubmit={saveConnection}
        />
      )}
    </div>
  )
}
