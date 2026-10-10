import type { FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AuditEntry, AuditFilters } from './types'

type Props = {
  audit: AuditEntry[]
  filters: AuditFilters
  onFiltersChange: (filters: AuditFilters) => void
  onSubmit: (event: FormEvent) => void
}

export function AuditSection({ audit, filters, onFiltersChange, onSubmit }: Props) {
  return (
    <section className="admin-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">SECURITY EVENTS</span>
          <h2>Audit log</h2>
          <p>Search authentication, privacy, and administrator activity.</p>
        </div>
        <span className="count-pill">{audit.length} events</span>
      </div>
      <form className="audit-filters" onSubmit={onSubmit}>
        <label>
          Event
          <input
            value={filters.event}
            onChange={(event) => onFiltersChange({ ...filters, event: event.target.value })}
            placeholder="e.g. auth.login"
          />
        </label>
        <label>
          Outcome
          <select
            value={filters.outcome}
            onChange={(event) => onFiltersChange({ ...filters, outcome: event.target.value })}
          >
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="denied">Denied</option>
          </select>
        </label>
        <label>
          Username
          <input
            value={filters.username}
            onChange={(event) => onFiltersChange({ ...filters, username: event.target.value })}
            placeholder="Filter actor"
          />
        </label>
        <button className="button button-primary">
          <RefreshCw size={15} />
          Apply filters
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event</th>
              <th>Outcome</th>
              <th>Actor</th>
              <th>Details</th>
              <th>Request ID</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((entry, index) => (
              <tr key={`${entry.timestamp}-${index}`}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td>
                  <code>{entry.event}</code>
                </td>
                <td>
                  <span className={`outcome ${entry.outcome}`}>{entry.outcome}</span>
                </td>
                <td>{entry.actor?.username ?? 'System'}</td>
                <td>
                  {entry.details
                    ? Object.entries(entry.details)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' / ')
                    : '-'}
                </td>
                <td>
                  <code className="request-id">{entry.request_id ?? '-'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.length === 0 && <div className="table-empty">No audit events match these filters.</div>}
      </div>
    </section>
  )
}
