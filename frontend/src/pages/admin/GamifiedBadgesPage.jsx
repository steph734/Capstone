import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialBadges } from './gamifiedLibraryData'

const emptyForm = { name: '', icon: '🏅', points: 10, criteria: '', status: 'Active' }

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export default function GamifiedBadgesPage({ user, onLogout }) {
  const [badges, setBadges] = useState(initialBadges)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const editingBadge = useMemo(() => badges.find((badge) => badge.id === editingId) || null, [badges, editingId])

  const stats = useMemo(() => {
    const active = badges.filter((badge) => badge.status === 'Active')
    const hidden = badges.filter((badge) => badge.status === 'Hidden')
    const totalPoints = badges.reduce((sum, badge) => sum + Number(badge.points || 0), 0)
    return { total: badges.length, active: active.length, hidden: hidden.length, totalPoints }
  }, [badges])

  const visibleBadges = useMemo(() => {
    if (statusFilter === 'All') return badges
    return badges.filter((badge) => badge.status === statusFilter)
  }, [badges, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowEditor(true)
  }

  const openEdit = (badge) => {
    setEditingId(badge.id)
    setForm({ name: badge.name, icon: badge.icon, points: badge.points, criteria: badge.criteria, status: badge.status })
    setShowEditor(true)
  }

  const saveBadge = (event) => {
    event.preventDefault()
    const payload = { ...form, points: Number(form.points) || 0 }
    if (editingBadge) {
      setBadges((current) => current.map((badge) => (badge.id === editingBadge.id ? { ...badge, ...payload } : badge)))
    } else {
      setBadges((current) => [...current, { id: Date.now(), ...payload }])
    }
    setShowEditor(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setBadges((current) => current.filter((badge) => badge.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const filters = [
    { key: 'All', label: 'All' },
    { key: 'Active', label: 'Active' },
    { key: 'Hidden', label: 'Hidden' },
  ]

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Badges"
      subtitle="Create and manage badges patients can unlock"
      icon="🏅"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Total Badges</p>
          <h3 className="admin-stat-value">{stats.total}</h3>
          <p className="admin-stat-meta">In the library</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Active</p>
          <h3 className="admin-stat-value">{stats.active}</h3>
          <p className="admin-stat-meta">Visible to patients</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Hidden</p>
          <h3 className="admin-stat-value">{stats.hidden}</h3>
          <p className="admin-stat-meta">Not yet visible</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Points Across Badges</p>
          <h3 className="admin-stat-value">{stats.totalPoints}</h3>
          <p className="admin-stat-meta">Combined badge value</p>
        </section>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Badges</h3>
            <p>Reward patients for milestones and consistent practice</p>
          </div>
          <button className="admin-btn" onClick={openCreate}>Add Badge</button>
        </div>

        <div className="admin-toolbar" style={{ marginBottom: '16px' }}>
          <div className="admin-button-row">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={statusFilter === filter.key ? 'admin-btn' : 'admin-btn-secondary'}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="games-list">
          {visibleBadges.length === 0 && (
            <div className="game-card">
              <div>
                <h4>No badges found</h4>
                <p>Try a different filter or add a new badge.</p>
              </div>
            </div>
          )}
          {visibleBadges.map((badge) => (
            <div key={badge.id} className="game-card">
              <div className="game-card-main">
                <div className="branch-card-title-row">
                  <span className="admin-modal-icon" style={{ width: 32, height: 32, fontSize: 16 }} aria-hidden="true">{badge.icon}</span>
                  <h4>{badge.name}</h4>
                  <span className={`admin-pill ${badge.status === 'Active' ? 'green' : 'gray'}`}>{badge.status}</span>
                </div>
                <p>{badge.criteria}</p>
                <div className="admin-button-row" style={{ marginTop: '10px' }}>
                  <span className="admin-pill yellow">{badge.points} pts</span>
                </div>
              </div>
              <div className="admin-item-actions">
                <button className="admin-icon-btn admin-icon-edit" onClick={() => openEdit(badge)} title="Edit" aria-label={`Edit ${badge.name}`}>
                  <PencilIcon />
                </button>
                <button className="admin-icon-btn admin-icon-delete" onClick={() => setDeleteTarget(badge)} title="Delete" aria-label={`Delete ${badge.name}`}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showEditor && (
        <div className="admin-modal-backdrop" onClick={() => setShowEditor(false)}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon">🏅</span>
                <div>
                  <h3>{editingBadge ? 'Edit Badge' : 'Add Badge'}</h3>
                  <p>{editingBadge ? 'Update the badge details' : 'New badges are active automatically'}</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setShowEditor(false)} aria-label="Close">✕</button>
            </div>

            <form className="admin-modal-form" onSubmit={saveBadge}>
              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>Badge Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Streak Master"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Icon (Emoji)</span>
                  <input
                    value={form.icon}
                    onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
                    placeholder="🏅"
                    maxLength={4}
                    required
                  />
                </label>
              </div>

              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>Points Required</span>
                  <input
                    type="number"
                    min="0"
                    value={form.points}
                    onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))}
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Visibility</span>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    <option>Active</option>
                    <option>Hidden</option>
                  </select>
                </label>
              </div>

              <label className="admin-field">
                <span>Unlock Criteria</span>
                <textarea
                  value={form.criteria}
                  onChange={(event) => setForm((current) => ({ ...current, criteria: event.target.value }))}
                  placeholder="Briefly describe how patients earn this badge"
                  required
                />
              </label>

              <div className="admin-button-row">
                <button className="admin-btn" type="submit">{editingBadge ? 'Save Changes' : 'Save Badge'}</button>
                <button className="admin-btn-secondary" type="button" onClick={() => setShowEditor(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon">🗑️</div>
            <h3 className="admin-confirm-title">Delete Badge?</h3>
            <p className="admin-confirm-msg">
              This will permanently remove <strong>{deleteTarget.name}</strong> from the badge library. This cannot be undone.
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-confirm-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="admin-confirm-ok" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
