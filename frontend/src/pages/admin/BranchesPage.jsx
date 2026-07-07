import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const initialBranches = [
  { id: 1, name: 'Therapy Pro - Davao Main', location: 'Davao City', therapists: 12, status: 'Active', archived: false },
  { id: 2, name: 'Therapy Pro - North Branch', location: 'Cagayan de Oro', therapists: 7, status: 'Active', archived: false },
  { id: 3, name: 'Therapy Pro - Cebu Branch', location: 'Cebu City', therapists: 9, status: 'Review', archived: false },
]

const emptyForm = { name: '', location: '', therapists: '' }

const pillClass = {
  Active: 'green',
  Review: 'yellow',
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

export default function BranchesPage({ user, onLogout }) {
  const [branches, setBranches] = useState(initialBranches)
  const [activeFilter, setActiveFilter] = useState('All')

  const [modalMode, setModalMode] = useState(null) // 'add' | 'edit' | 'view' | null
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const activeBranches = useMemo(() => branches.filter((branch) => !branch.archived), [branches])
  const archivedBranches = useMemo(() => branches.filter((branch) => branch.archived), [branches])

  const stats = useMemo(() => {
    const active = activeBranches.filter((branch) => branch.status === 'Active')
    const review = activeBranches.filter((branch) => branch.status === 'Review')
    const totalTherapists = activeBranches.reduce((sum, branch) => sum + Number(branch.therapists || 0), 0)
    return { total: activeBranches.length, active: active.length, review: review.length, totalTherapists }
  }, [activeBranches])

  const visibleBranches = useMemo(() => {
    if (activeFilter === 'Archived') return archivedBranches
    if (activeFilter === 'All') return activeBranches
    return activeBranches.filter((branch) => branch.status === activeFilter)
  }, [activeBranches, archivedBranches, activeFilter])

  const closeModal = () => {
    setModalMode(null)
    setSelectedBranch(null)
  }

  const openAdd = () => {
    setForm(emptyForm)
    setSelectedBranch(null)
    setModalMode('add')
  }

  const openView = (branch) => {
    setSelectedBranch(branch)
    setModalMode('view')
  }

  const openEdit = (branch) => {
    setSelectedBranch(branch)
    setForm({
      name: branch.name,
      location: branch.location,
      therapists: String(branch.therapists),
    })
    setModalMode('edit')
  }

  const requestToggleArchive = (branch) => {
    setConfirmTarget(branch)
  }

  const confirmToggleArchive = () => {
    if (!confirmTarget) return
    const id = confirmTarget.id
    setBranches((current) =>
      current.map((item) => (item.id === id ? { ...item, archived: !item.archived } : item))
    )
    setConfirmTarget(null)
  }

  const saveBranch = (event) => {
    event.preventDefault()
    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      therapists: Number(form.therapists) || 0,
    }

    if (modalMode === 'edit' && selectedBranch) {
      setBranches((current) =>
        current.map((item) => (item.id === selectedBranch.id ? { ...item, ...payload } : item))
      )
    } else {
      setBranches((current) => [...current, { id: Date.now(), ...payload, status: 'Active', archived: false }])
    }
    closeModal()
  }

  const isFormModal = modalMode === 'add' || modalMode === 'edit'

  const filters = [
    { key: 'All', label: 'All' },
    { key: 'Active', label: 'Active' },
    { key: 'Review', label: 'Review' },
    { key: 'Archived', label: `Archived (${archivedBranches.length})` },
  ]

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Branches"
      subtitle="View and manage clinic locations"
      icon="🏢"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Total Branches</p>
          <h3 className="admin-stat-value">{stats.total}</h3>
          <p className="admin-stat-meta">Across all regions</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Active Branches</p>
          <h3 className="admin-stat-value">{stats.active}</h3>
          <p className="admin-stat-meta">Currently operating</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Under Review</p>
          <h3 className="admin-stat-value">{stats.review}</h3>
          <p className="admin-stat-meta">Pending approval</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Therapists Assigned</p>
          <h3 className="admin-stat-value">{stats.totalTherapists}</h3>
          <p className="admin-stat-meta">Across all branches</p>
        </section>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Branch Directory</h3>
            <p>Unified branch overview in the same patient-style shell</p>
          </div>
          <button className="admin-btn" onClick={openAdd}>Add Branch</button>
        </div>

        <div className="admin-toolbar" style={{ marginBottom: '16px' }}>
          <div className="admin-button-row">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={activeFilter === filter.key ? 'admin-btn' : 'admin-btn-secondary'}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-list">
          {visibleBranches.length === 0 && (
            <div className="admin-list-item">
              <div>
                <h4>No branches found</h4>
                <p>Try a different filter or add a new branch.</p>
              </div>
            </div>
          )}
          {visibleBranches.map((branch) => (
            <div key={branch.id} className="branch-card">
              <div className="branch-card-main">
                <div className="branch-card-title-row">
                  <h4>{branch.name}</h4>
                  <span className={`admin-pill ${pillClass[branch.status] || 'gray'}`}>{branch.status}</span>
                  {branch.archived && <span className="admin-archived-pill">Archived</span>}
                </div>
                <p>{branch.location} · {branch.therapists} therapists assigned</p>
              </div>
              <div className="admin-item-actions">
                <button className="admin-icon-btn admin-icon-view" onClick={() => openView(branch)} title="View" aria-label={`View ${branch.name}`}>
                  <EyeIcon />
                </button>
                <button className="admin-icon-btn admin-icon-edit" onClick={() => openEdit(branch)} title="Edit" aria-label={`Edit ${branch.name}`}>
                  <PencilIcon />
                </button>
                <button
                  className={`admin-icon-btn ${branch.archived ? 'admin-icon-restore' : 'admin-icon-archive'}`}
                  onClick={() => requestToggleArchive(branch)}
                  title={branch.archived ? 'Restore' : 'Archive'}
                  aria-label={`${branch.archived ? 'Restore' : 'Archive'} ${branch.name}`}
                >
                  {branch.archived ? <RestoreIcon /> : <ArchiveIcon />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isFormModal && (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon">🏢</span>
                <div>
                  <h3>{modalMode === 'edit' ? 'Edit Branch' : 'Add Branch'}</h3>
                  <p>{modalMode === 'edit' ? 'Update this clinic location' : 'Register a new clinic location'}</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <form className="admin-modal-form" onSubmit={saveBranch}>
              <label className="admin-field">
                <span>Branch Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Therapy Pro - Iloilo Branch"
                  required
                />
              </label>

              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>City / Location</span>
                  <input
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder="e.g. Iloilo City"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Therapists Assigned</span>
                  <input
                    type="number"
                    min="0"
                    value={form.therapists}
                    onChange={(event) => setForm((current) => ({ ...current, therapists: event.target.value }))}
                    placeholder="0"
                    required
                  />
                </label>
              </div>

              <div className="admin-button-row">
                <button className="admin-btn" type="submit">{modalMode === 'edit' ? 'Save Changes' : 'Save Branch'}</button>
                <button className="admin-btn-secondary" type="button" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode === 'view' && selectedBranch && (
        <div className="admin-modal-backdrop" onClick={closeModal}>
          <div className="admin-modal admin-view-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon">🏢</span>
                <div>
                  <h3>{selectedBranch.name}</h3>
                  <p>Branch details</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <div className="branch-view-grid">
              <div className="branch-view-field">
                <span className="branch-view-label">Branch Name</span>
                <p>{selectedBranch.name}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Status</span>
                <p>
                  <span className={`admin-pill ${pillClass[selectedBranch.status] || 'gray'}`}>{selectedBranch.status}</span>
                  {selectedBranch.archived && <span className="admin-archived-pill" style={{ marginLeft: '8px' }}>Archived</span>}
                </p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Location</span>
                <p>{selectedBranch.location}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Therapists Assigned</span>
                <p>{selectedBranch.therapists}</p>
              </div>
            </div>

            <div className="admin-button-row admin-view-modal-footer">
              <button className="admin-btn-secondary" type="button" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="admin-modal-backdrop" onClick={() => setConfirmTarget(null)}>
          <div className="admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon">{confirmTarget.archived ? '🔄' : '📦'}</div>
            <h3 className="admin-confirm-title">{confirmTarget.archived ? 'Restore Branch?' : 'Archive Branch?'}</h3>
            <p className="admin-confirm-msg">
              {confirmTarget.archived
                ? <>This branch will be restored to the active list. It will reappear in "All" and status filters.</>
                : <>This branch will be moved to the archived list. You can still view it later.</>}
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-confirm-cancel" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button className="admin-confirm-ok" onClick={confirmToggleArchive}>
                {confirmTarget.archived ? 'Yes, Restore' : 'Yes, Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
