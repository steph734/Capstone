import { useEffect, useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { getAuditLogs } from '../../utils/auditLog'
import './AuditLogsPage.css'

// Backend-recorded security events (account lockouts, etc.) use a plain
// action string — map it to the icon/label shown on the Activity Feed.
const SERVER_ACTION_META = {
  account_locked: { icon: '🔒', label: 'Account Locked' },
  login_failed_after_lockout: { icon: '🚨', label: 'Repeated Failed Login' },
}

function mapServerLog(log) {
  const created = new Date(log.created_at)
  const meta = SERVER_ACTION_META[log.action] || { icon: '🧾', label: log.action }
  return {
    id: `server-${log.id}`,
    date: created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    role: log.role,
    user: log.user,
    email: log.email,
    actionIcon: meta.icon,
    action: meta.label,
    description: log.description,
    entity: `IP ${log.ip_address}`,
    status: 'Failed',
  }
}

const ROLE_FILTERS = [
  { key: 'All', label: 'All', cls: 'all' },
  { key: 'Owner', label: 'Owner', cls: 'owner' },
  { key: 'Therapist', label: 'Therapist', cls: 'therapist' },
  { key: 'Patient', label: 'Patient', cls: 'patient' },
]

const STATUS_CLASS = { Success: 'success', Review: 'review', Failed: 'failed' }
const ROLE_CLASS = { Owner: 'owner', Therapist: 'therapist', Patient: 'patient', System: 'system' }

export default function AuditLogsPage({ user, onLogout }) {
  const [logs, setLogs] = useState(() => getAuditLogs())
  const [roleFilter, setRoleFilter] = useState('All')
  const [fromDate, setFromDate] = useState('2026-06-06')
  const [toDate, setToDate] = useState('2026-07-06')
  const [search, setSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/audit-logs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.logs?.length) return
        setLogs((existing) => {
          const serverLogs = data.logs.map(mapServerLog)
          const knownIds = new Set(existing.map((l) => l.id))
          const fresh = serverLogs.filter((l) => !knownIds.has(l.id))
          return fresh.length ? [...fresh, ...existing] : existing
        })
      })
      .catch(() => {
        // Backend unreachable (offline, or plain `npm run dev`) — keep local demo data.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => ({
    All: logs.length,
    Owner: logs.filter((l) => l.role === 'Owner').length,
    Therapist: logs.filter((l) => l.role === 'Therapist').length,
    Patient: logs.filter((l) => l.role === 'Patient').length,
  }), [logs])

  const visibleLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesRole = roleFilter === 'All' || log.role === roleFilter
      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        log.action.toLowerCase().includes(query) ||
        log.description.toLowerCase().includes(query) ||
        log.user.toLowerCase().includes(query) ||
        String(log.id).includes(query)
      return matchesRole && matchesSearch
    })
  }, [logs, roleFilter, search])

  const handleClear = () => {
    setRoleFilter('All')
    setSearch('')
    setFromDate('2026-06-06')
    setToDate('2026-07-06')
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Audit Logs"
      subtitle="Track administrative changes and actions"
      icon="🧾"
      menuItems={adminMenuItems}
    >
      {/* ── Dark banner ── */}
      <div className="al-banner">
        <div className="al-banner-title">
          <span className="al-banner-icon">🛡️</span>
          <div>
            <h2>Activity Audit Logs</h2>
            <p>All actions performed by Owner, Therapist, and Patient accounts</p>
          </div>
        </div>
        <span className="al-banner-meta">Last 30 days by default · {logs.length} total entries</span>
      </div>

      {/* ── Role stat cards ── */}
      <div className="al-stats-grid">
        <div className="al-stat-card">
          <div className="al-stat-num">{counts.All}</div>
          <div className="al-stat-label">All Activities</div>
        </div>
        <div className="al-stat-card owner">
          <div className="al-stat-num">{counts.Owner}</div>
          <div className="al-stat-label">Owner</div>
        </div>
        <div className="al-stat-card therapist">
          <div className="al-stat-num">{counts.Therapist}</div>
          <div className="al-stat-label">Therapist</div>
        </div>
        <div className="al-stat-card patient">
          <div className="al-stat-num">{counts.Patient}</div>
          <div className="al-stat-label">Patient</div>
        </div>
      </div>

      {/* ── Role filter pills ── */}
      <div className="al-filter-row">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`al-filter-pill ${f.cls} ${roleFilter === f.key ? 'active' : ''}`}
            onClick={() => setRoleFilter(f.key)}
          >
            {f.label}
            <span className="al-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* ── Date range + search ── */}
      <div className="al-filter-bar">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, user, description…"
        />
        <button type="button" className="al-filter-btn">🔍 Filter</button>
        <button type="button" className="al-clear-btn" onClick={handleClear}>✕ Clear</button>
        <span className="al-showing">Showing {visibleLogs.length} of {logs.length} records</span>
      </div>

      {/* ── Activity Feed table ── */}
      <div className="admin-table-card">
        <div className="al-feed-header" style={{ padding: '16px 20px 0' }}>
          <h3>📋 Activity Feed</h3>
          <span className="al-feed-page">Page 1 of 1</span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Role</th>
                <th>User</th>
                <th>Action</th>
                <th>Description</th>
                <th>Entity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.length === 0 && (
                <tr><td colSpan={8}><p className="al-empty">No activity found for this filter.</p></td></tr>
              )}
              {visibleLogs.map((log) => (
                <tr key={log.id}>
                  <td className="al-timestamp">
                    <div className="al-date">{log.date}</div>
                    <div className="al-time">{log.time}</div>
                  </td>
                  <td><span className={`al-role-badge ${ROLE_CLASS[log.role] || 'system'}`}>{log.role}</span></td>
                  <td>
                    <div className="al-user-name">{log.user}</div>
                    <div className="al-user-email">{log.email}</div>
                  </td>
                  <td><span className="al-action-badge">{log.actionIcon} {log.action}</span></td>
                  <td><span className="al-description" title={log.description}>{log.description}</span></td>
                  <td><span className="al-entity-badge">{log.entity}</span></td>
                  <td><span className={`al-status ${STATUS_CLASS[log.status] || ''}`}>{log.status}</span></td>
                  <td>
                    <button className="admin-icon-btn admin-icon-view" onClick={() => setSelectedLog(log)} title="View" aria-label={`View log ${log.id}`}>
                      👁️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="admin-modal admin-view-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon">🧾</span>
                <div>
                  <h3>Log #{selectedLog.id}</h3>
                  <p>Audit log details</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setSelectedLog(null)} aria-label="Close">✕</button>
            </div>

            <div className="branch-view-grid">
              <div className="branch-view-field">
                <span className="branch-view-label">Log ID</span>
                <p>#{selectedLog.id}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Status</span>
                <p><span className={`al-status ${STATUS_CLASS[selectedLog.status] || ''}`}>{selectedLog.status}</span></p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Role</span>
                <p><span className={`al-role-badge ${ROLE_CLASS[selectedLog.role] || 'system'}`}>{selectedLog.role}</span></p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">User</span>
                <p>{selectedLog.user} ({selectedLog.email})</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Action</span>
                <p>{selectedLog.actionIcon} {selectedLog.action}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Description</span>
                <p>{selectedLog.description}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Entity</span>
                <p>{selectedLog.entity}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Timestamp</span>
                <p>{selectedLog.date}, {selectedLog.time}</p>
              </div>
            </div>

            <div className="admin-button-row admin-view-modal-footer">
              <button className="admin-btn-secondary" type="button" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
