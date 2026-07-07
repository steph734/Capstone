import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const initialGames = [
  { id: 1, name: 'Memory Match', type: 'Cognitive', level: 'Easy', status: 'Published', description: 'Card matching for memory recall.' },
  { id: 2, name: 'Sound Builder', type: 'Speech', level: 'Medium', status: 'Draft', description: 'Drag sounds to build words.' },
  { id: 3, name: 'Balance Quest', type: 'Physical', level: 'Hard', status: 'Published', description: 'Movement game with timed balance tasks.' },
]

export default function GamesLibraryPage({ user, onLogout }) {
  const [games, setGames] = useState(initialGames)
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Cognitive', level: 'Easy', status: 'Draft', description: '' })

  const editingGame = useMemo(() => games.find((game) => game.id === editingId) || null, [games, editingId])

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', type: 'Cognitive', level: 'Easy', status: 'Draft', description: '' })
    setShowEditor(true)
  }

  const openEdit = (game) => {
    setEditingId(game.id)
    setForm({ name: game.name, type: game.type, level: game.level, status: game.status, description: game.description })
    setShowEditor(true)
  }

  const saveGame = (event) => {
    event.preventDefault()
    if (editingGame) {
      setGames((currentGames) => currentGames.map((game) => (game.id === editingGame.id ? { ...game, ...form } : game)))
    } else {
      setGames((currentGames) => [...currentGames, { id: Date.now(), ...form }])
    }
    setShowEditor(false)
  }

  const deleteGame = (id) => {
    setGames((currentGames) => currentGames.filter((game) => game.id !== id))
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Games Library"
      subtitle="Add, edit, or delete gamified exercises"
      icon="🎮"
      menuItems={adminMenuItems}
    >
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Gamified Exercises</h3>
            <p>Manage interactive therapy games from one place</p>
          </div>
          <button className="admin-btn" onClick={openCreate}>Add Game</button>
        </div>

        <div className="games-list">
          {games.map((game) => (
            <div key={game.id} className="game-card">
              <div>
                <h4>{game.name}</h4>
                <p>{game.description}</p>
                <div className="admin-button-row" style={{ marginTop: '10px' }}>
                  <span className="admin-pill green">{game.type}</span>
                  <span className="admin-pill yellow">{game.level}</span>
                  <span className="admin-pill red">{game.status}</span>
                </div>
              </div>
              <div className="game-actions">
                <button className="admin-btn-secondary" onClick={() => openEdit(game)}>Edit</button>
                <button className="admin-btn-danger" onClick={() => deleteGame(game.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showEditor && (
        <div className="admin-modal-backdrop" onClick={() => setShowEditor(false)}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>{editingGame ? 'Edit Game' : 'Add Game'}</h3>
                <p>Update the gamified exercise details</p>
              </div>
              <button className="admin-btn-secondary" onClick={() => setShowEditor(false)}>Close</button>
            </div>

            <form className="admin-modal-form" onSubmit={saveGame}>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Game name"
                required
              />
              <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                <option>Cognitive</option>
                <option>Speech</option>
                <option>Physical</option>
                <option>Occupational</option>
              </select>
              <select value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option>Draft</option>
                <option>Published</option>
              </select>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description"
                required
              />
              <div className="admin-button-row">
                <button className="admin-btn" type="submit">Save Game</button>
                <button className="admin-btn-secondary" type="button" onClick={() => setShowEditor(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
