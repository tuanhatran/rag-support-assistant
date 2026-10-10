import { Pencil } from 'lucide-react'
import type { Connection } from '../../types/connections'
import type { Plan } from '../../types/account'
import { planLabels, type AdminUser, type UserEdit } from './types'

type Props = {
  users: AdminUser[]
  connections: Connection[]
  userEdits: Record<string, UserEdit>
  savingUsers: Set<string>
  onStartEdit: (user: AdminUser) => void
  onCancelEdit: (user: AdminUser) => void
  onStageEdit: (user: AdminUser, field: keyof UserEdit, value: UserEdit[keyof UserEdit]) => void
  onConfirmEdit: (user: AdminUser) => void
}

export function UsersSection({ users, connections, userEdits, savingUsers, onStartEdit, onCancelEdit, onStageEdit, onConfirmEdit }: Props) {
  return <section className="admin-section"><div className="section-toolbar"><div><span className="eyebrow">IDENTITY &amp; ACCESS</span><h2>User accounts</h2><p>Change a user's support plan or role. The last admin cannot be demoted.</p></div><span className="count-pill">{users.length} accounts</span></div><div className="table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Plan</th><th>Created</th><th>Model assignment</th><th>Action</th></tr></thead><tbody>{users.map(user => {
    const assigned = connections.find(connection => connection.plans.includes(user.plan))
    const staged = userEdits[user.id]
    const isSaving = savingUsers.has(user.id)
    const hasChanges = staged !== undefined && (staged.role !== user.role || staged.plan !== user.plan)
    return <tr key={user.id}>
      <td><b className="table-primary">{user.username}</b>{user.role === 'admin' && <span className="admin-user-label">ADMIN</span>}</td>
      <td>{staged ? <><label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.username}</label><select id={`role-${user.id}`} className="table-select" value={staged.role} disabled={isSaving} onChange={event => onStageEdit(user, 'role', event.target.value as AdminUser['role'])}><option value="user">User</option><option value="admin">Admin</option></select></> : <span className="user-role">{user.role}</span>}</td>
      <td>{staged ? <><label className="sr-only" htmlFor={`plan-${user.id}`}>Plan for {user.username}</label><select id={`plan-${user.id}`} className="table-select" value={staged.plan} disabled={isSaving} onChange={event => onStageEdit(user, 'plan', event.target.value as Plan)}>{planLabels.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></> : <span className={`plan-badge ${user.plan}`}>{user.plan}</span>}</td>
      <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
      <td>{assigned ? <span>{assigned.model}</span> : <span className="missing-model">No model assigned</span>}</td>
      <td><div className="user-row-actions">{staged ? <>{hasChanges && <button type="button" className="button button-primary" disabled={isSaving} onClick={() => onConfirmEdit(user)}>{isSaving ? 'Saving...' : 'Confirm'}</button>}<button type="button" className="button" disabled={isSaving} onClick={() => onCancelEdit(user)}>Cancel</button></> : <button type="button" className="icon-button" title={`Edit ${user.username}`} aria-label={`Edit ${user.username}`} onClick={() => onStartEdit(user)}><Pencil size={15} /></button>}</div></td>
    </tr>
  })}</tbody></table></div></section>
}