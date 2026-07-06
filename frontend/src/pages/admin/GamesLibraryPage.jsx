import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const initialGames = [
  { id: 1, name: 'Memory Match', type: 'Cognitive', level: 'Easy', status: 'Published', description: 'Card matching for memory recall.' },
  { id: 2, name: 'Sound Builder', type: 'Speech', level: 'Medium', status: 'Draft', description: 'Drag sounds to build words.' },
  { id: 3, name: 'Balance Quest', type: 'Physical', level: 'Hard', status: 'Published', description: 'Movement game with timed balance tasks.' },
]

const emptyForm = { name: '', type: 'Cognitive', level: 'Easy', description: '' }

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

export default function GamesLibraryPage({ user, onLogout }) {
  const [games, setGames] = useState(initialGames)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const editingGame = useMemo(() => games.find((game) => game.id === editingId) || null, [games, editingId])

  const stats = useMemo(() => {
    const published = games.filter((game) => game.status === 'Published')
    const draft = games.filter((game) => game.status === 'Draft')
    const categories = new Set(games.map((game) => game.type)).size
    return { total: games.length, published: published.length, draft: draft.length, categories }
  }, [games])

  const visibleGames = useMemo(() => {
    if (statusFilter === 'All') return games
    return games.filter((game) => game.status === statusFilter)
  }, [games, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowEditor(true)
  }

  const openEdit = (game) => {
    setEditingId(game.id)
    setForm({ name: game.name, type: game.type, level: game.level, description: game.description })
    setShowEditor(true)
  }

  const saveGame = (event) => {
    event.preventDefault()
    if (editingGame) {
      setGames((currentGames) => currentGames.map((game) => (game.id === editingGame.id ? { ...game, ...form } : game)))
    } else {
      setGames((currentGames) => [...currentGames, { id: Date.now(), ...form, status: 'Published' }])
    }
    setShowEditor(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setGames((currentGames) => currentGames.filter((game) => game.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const filters = [
    { key: 'All', label: 'All' },
    { key: 'Published', label: 'Published' },
    { key: 'Draft', label: 'Draft' },
  ]

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Games Library"
      subtitle="Add, edit, or delete gamified exercises"
      icon="🎮"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Total Games</p>
          <h3 className="admin-stat-value">{stats.total}</h3>
          <p className="admin-stat-meta">In the library</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Published</p>
          <h3 className="admin-stat-value">{stats.published}</h3>
          <p className="admin-stat-meta">Live for patients</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Draft</p>
          <h3 className="admin-stat-value">{stats.draft}</h3>
          <p className="admin-stat-meta">Not yet visible</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Categories Covered</p>
          <h3 className="admin-stat-value">{stats.categories}</h3>
          <p className="admin-stat-meta">Across therapy types</p>
        </section>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Gamified Exercises</h3>
            <p>Manage interactive therapy games from one place</p>
          </div>
          <button className="admin-btn" onClick={openCreate}>Add Game</button>
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
          {visibleGames.length === 0 && (
            <div className="game-card">
              <div>
                <h4>No games found</h4>
                <p>Try a different filter or add a new game.</p>
              </div>
            </div>
          )}
          {visibleGames.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-card-main">
                <div className="branch-card-title-row">
                  <h4>{game.name}</h4>
                  <span className={`admin-pill ${game.status === 'Published' ? 'green' : 'yellow'}`}>{game.status}</span>
                </div>
                <p>{game.description}</p>
                <div className="admin-button-row" style={{ marginTop: '10px' }}>
                  <span className="admin-pill gray">{game.type}</span>
                  <span className="admin-pill yellow">{game.level}</span>
                </div>
              </div>
              <div className="admin-item-actions">
                <button className="admin-icon-btn admin-icon-edit" onClick={() => openEdit(game)} title="Edit" aria-label={`Edit ${game.name}`}>
                  <PencilIcon />
                </button>
                <button className="admin-icon-btn admin-icon-delete" onClick={() => setDeleteTarget(game)} title="Delete" aria-label={`Delete ${game.name}`}>
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
                <span className="admin-modal-icon">🎮</span>
                <div>
                  <h3>{editingGame ? 'Edit Game' : 'Add Game'}</h3>
                  <p>{editingGame ? 'Update the gamified exercise details' : 'New games are published automatically'}</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setShowEditor(false)} aria-label="Close">✕</button>
            </div>

            <form className="admin-modal-form" onSubmit={saveGame}>
              <label className="admin-field">
                <span>Game Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Word Builder"
                  required
                />
              </label>

              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>Therapy Type</span>
                  <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                    <option>Cognitive</option>
                    <option>Speech</option>
                    <option>Physical</option>
                    <option>Occupational</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>Difficulty Level</span>
                  <select value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
              </div>

              <label className="admin-field">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Briefly describe the exercise"
                  required
                />
              </label>

              <div className="admin-button-row">
                <button className="admin-btn" type="submit">{editingGame ? 'Save Changes' : 'Save Game'}</button>
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
            <h3 className="admin-confirm-title">Delete Game?</h3>
            <p className="admin-confirm-msg">
              This will permanently remove <strong>{deleteTarget.name}</strong> from the games library. This cannot be undone.
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
