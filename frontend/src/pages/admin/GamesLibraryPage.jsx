import { useEffect, useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGameRequests } from './gamifiedLibraryData'
import { GameControllerIcon, PencilIcon, TrashIcon } from './gamifiedIcons'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/api'

const GAME_TYPE_OPTIONS = [
  { value: 'picture_match',  label: 'Picture Match' },
  { value: 'sort_place',     label: 'Sort & Place' },
  { value: 'choose_picture', label: 'Choose the Picture' },
  { value: 'step_by_step',   label: 'Step by Step' },
  { value: 'say_it',         label: 'Say It' },
  { value: 'move_with_me',   label: 'Move With Me' },
]

const emptyForm = { name: '', type: 'Cognitive', level: 'Easy', gameType: 'picture_match', description: '', points: 10 }

const TYPE_ICON = { Cognitive: '🧩', Speech: '🎤', Physical: '🏃', Occupational: '✋' }

const AVATAR_COLORS = ['#4a6b5d', '#e46a4b', '#3b82f6', '#8b5cf6', '#d97706']

function avatarColorFor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// The backend's `games` collection stores therapy_type/difficulty/status as
// lowercase enum strings (matches the Atlas $jsonSchema validator); this UI
// displays them capitalized, same as before this was wired to MongoDB.
function fromApiGame(g) {
  return {
    id: g.id,
    name: g.name,
    type: capitalize(g.therapyType),
    level: capitalize(g.difficulty || 'easy'),
    status: capitalize(g.status),
    description: g.description,
    points: g.pointsPerPlay ?? 0,
    gameType: g.gameType,
  }
}

export default function GamesLibraryPage({ user, onLogout }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [requests, setRequests] = useState(initialGameRequests)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [declineTarget, setDeclineTarget] = useState(null)
  const [viewRequest, setViewRequest] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const loadGames = () => {
    setLoading(true)
    setLoadError('')
    apiGet('/api/games')
      .then((data) => setGames((data.games || []).map(fromApiGame)))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(loadGames, [])

  const editingGame = useMemo(() => games.find((game) => game.id === editingId) || null, [games, editingId])

  const visibleGames = useMemo(() => {
    if (statusFilter === 'All') return games
    return games.filter((game) => game.status === statusFilter)
  }, [games, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setSaveError('')
    setShowEditor(true)
  }

  const openEdit = (game) => {
    setEditingId(game.id)
    setForm({ name: game.name, type: game.type, level: game.level, gameType: game.gameType, description: game.description, points: game.points ?? 10 })
    setSaveError('')
    setShowEditor(true)
  }

  const saveGame = async (event) => {
    event.preventDefault()
    setSaveError('')
    const payload = {
      name: form.name,
      therapyType: form.type.toLowerCase(),
      difficulty: form.level.toLowerCase(),
      gameType: form.gameType,
      description: form.description,
      pointsPerPlay: Number(form.points) || 0,
    }

    try {
      if (editingGame) {
        payload.updatedBy = user?.id
        await apiPatch(`/api/games/${editingGame.id}`, payload)
      } else {
        payload.createdBy = user?.id
        await apiPost('/api/games', payload)
      }
      setShowEditor(false)
      loadGames()
    } catch (err) {
      setSaveError(err.message)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiDelete(`/api/games/${deleteTarget.id}`)
      setGames((currentGames) => currentGames.filter((game) => game.id !== deleteTarget.id))
    } catch (err) {
      setLoadError(err.message)
    }
    setDeleteTarget(null)
  }

  const togglePublish = async (game) => {
    const nextStatus = game.status === 'Published' ? 'draft' : 'published'
    try {
      await apiPatch(`/api/games/${game.id}`, { status: nextStatus, updatedBy: user?.id })
      setGames((currentGames) => currentGames.map((g) => (g.id === game.id ? { ...g, status: capitalize(nextStatus) } : g)))
    } catch (err) {
      setLoadError(err.message)
    }
  }

  // Approving opens the creation workspace (the Add/Edit Game form) prefilled
  // with what the owner asked for, and clears the request from the pending list.
  const approveRequest = (request) => {
    setRequests((current) => current.filter((r) => r.id !== request.id))
    setEditingId(null)
    setForm({ name: request.name, type: request.type, level: request.level, description: request.description, points: 10 })
    setShowEditor(true)
  }

  const confirmDecline = () => {
    if (!declineTarget) return
    setRequests((current) => current.filter((r) => r.id !== declineTarget.id))
    setDeclineTarget(null)
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
      title="Games"
      subtitle="Review owner requests and manage every therapy game"
      icon={<GameControllerIcon />}
      menuItems={adminMenuItems}
    >
      {requests.length > 0 && (
        <section className="grq-panel">
          <div className="grq-panel-header">
            <div className="grq-panel-title-row">
              <h3>Requests from owners</h3>
              <span className="grq-pending-badge">{requests.length} pending</span>
            </div>
            <p className="grq-panel-hint">Approve to open the request in the creation workspace</p>
          </div>

          <div className="grq-grid">
            {requests.map((request, i) => (
              <div key={request.id} className="grq-card">
                <div className="grq-card-top">
                  <span className="grq-avatar" style={{ background: avatarColorFor(i) }}>
                    {request.ownerName.charAt(0)}
                  </span>
                  <div className="grq-card-who">
                    <span className="grq-owner-name">{request.ownerName}</span>
                    <span className="grq-owner-meta">({request.branch}) · {request.submitted}</span>
                  </div>
                  <span className="grq-pending-pill">Pending</span>
                </div>

                <h4 className="grq-card-title">{request.name}</h4>
                <p className="grq-card-desc">{request.description}</p>

                <div className="admin-button-row" style={{ marginTop: '4px' }}>
                  <span className="admin-pill gray">{request.type}</span>
                  <span className="admin-pill yellow">{request.level}</span>
                </div>

                <button type="button" className="grq-view-link" onClick={() => setViewRequest(request)}>
                  View full request →
                </button>

                <div className="grq-actions">
                  <button type="button" className="grq-decline-btn" onClick={() => setDeclineTarget(request)}>Decline</button>
                  <button type="button" className="grq-approve-btn" onClick={() => approveRequest(request)}>Approve &amp; Build</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>All games</h3>
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

        {loadError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px' }}>{loadError}</p>}

        <div className="games-list">
          {loading && (
            <div className="game-card">
              <div><h4>Loading games…</h4></div>
            </div>
          )}
          {!loading && visibleGames.length === 0 && (
            <div className="game-card">
              <div>
                <h4>No games found</h4>
                <p>Try a different filter or add a new game.</p>
              </div>
            </div>
          )}
          {!loading && visibleGames.map((game) => (
            <div key={game.id} className="aga-row">
              <span className="aga-icon">{TYPE_ICON[game.type] || '🎮'}</span>

              <div className="aga-main">
                <div className="branch-card-title-row">
                  <h4>{game.name}</h4>
                  <span className={`admin-pill ${game.status === 'Published' ? 'green' : 'yellow'}`}>{game.status}</span>
                </div>
                <p>{game.description}</p>
                <div className="admin-button-row" style={{ marginTop: '8px' }}>
                  <span className="admin-pill gray">{game.type}</span>
                  <span className="admin-pill yellow">{game.level}</span>
                </div>
              </div>

              <div className="aga-points">+{game.points ?? 0}<span>points per play</span></div>

              <div className="admin-item-actions">
                <button
                  className="admin-btn-secondary"
                  onClick={() => togglePublish(game)}
                  title={game.status === 'Published' ? 'Unpublish' : 'Publish'}
                >
                  {game.status === 'Published' ? 'Unpublish' : 'Publish'}
                </button>
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
                <span className="admin-modal-icon"><GameControllerIcon /></span>
                <div>
                  <h3>{editingGame ? 'Edit Game' : 'Add Game'}</h3>
                  <p>{editingGame ? 'Update the gamified exercise details' : 'New games start as a draft until you publish them'}</p>
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
                <span>Game Type</span>
                <select value={form.gameType} onChange={(event) => setForm((current) => ({ ...current, gameType: event.target.value }))}>
                  {GAME_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Points per Play</span>
                <input
                  type="number"
                  min="0"
                  value={form.points}
                  onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))}
                  placeholder="e.g. 10"
                  required
                />
              </label>

              <label className="admin-field">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Briefly describe the exercise"
                  required
                />
              </label>

              {saveError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '-8px 0 4px' }}>{saveError}</p>}

              <div className="admin-button-row">
                <button className="admin-btn" type="submit">{editingGame ? 'Save Changes' : 'Save Game'}</button>
                <button className="admin-btn-secondary" type="button" onClick={() => setShowEditor(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewRequest && (
        <div className="admin-modal-backdrop" onClick={() => setViewRequest(null)}>
          <div className="admin-modal admin-view-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon"><GameControllerIcon /></span>
                <div>
                  <h3>{viewRequest.name}</h3>
                  <p>Requested by {viewRequest.ownerName} ({viewRequest.branch})</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setViewRequest(null)} aria-label="Close">✕</button>
            </div>

            <div className="branch-view-grid">
              <div className="branch-view-field">
                <span className="branch-view-label">Therapy Type</span>
                <p>{viewRequest.type}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Difficulty</span>
                <p>{viewRequest.level}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Submitted</span>
                <p>{viewRequest.submitted}</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Status</span>
                <p>Pending</p>
              </div>
            </div>

            <div className="admin-field" style={{ marginTop: '16px' }}>
              <span>Description</span>
              <p style={{ margin: 0, color: '#4a5b53', fontSize: '14px', lineHeight: 1.6 }}>{viewRequest.description}</p>
            </div>

            <div className="admin-button-row admin-view-modal-footer">
              <button className="admin-btn-secondary" type="button" onClick={() => { setViewRequest(null); setDeclineTarget(viewRequest) }}>Decline</button>
              <button className="admin-btn" type="button" onClick={() => { setViewRequest(null); approveRequest(viewRequest) }}>Approve &amp; Build</button>
            </div>
          </div>
        </div>
      )}

      {declineTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeclineTarget(null)}>
          <div className="admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon" style={{ color: '#b45309' }}><TrashIcon size={32} /></div>
            <h3 className="admin-confirm-title">Decline Request?</h3>
            <p className="admin-confirm-msg">
              <strong>{declineTarget.ownerName}</strong>&apos;s request for <strong>{declineTarget.name}</strong> will be removed from the pending list.
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-confirm-cancel" onClick={() => setDeclineTarget(null)}>Cancel</button>
              <button className="admin-confirm-ok" onClick={confirmDecline}>Yes, Decline</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon" style={{ color: '#b45309' }}><TrashIcon size={32} /></div>
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
