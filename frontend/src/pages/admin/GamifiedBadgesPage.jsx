import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialBadges, initialGames } from './gamifiedLibraryData'
import { PAO_ITEMS, PAO_ITEM_CATEGORIES } from '../../data/paoItems'
import {
  MedalIcon, PencilIcon, TrashIcon, EyeIcon, EyeOffIcon, UsersIcon,
  ShuffleIcon, GameControllerIcon,
} from './gamifiedIcons'
import './GamifiedBadgesPage.css'

/* ── Badge design options ─────────────────────────────────── */
const SHAPES = [
  { id: 'circle',  label: 'Circle',  style: { borderRadius: '50%' } },
  { id: 'shield',  label: 'Shield',  style: { clipPath: 'polygon(50% 0%, 100% 20%, 100% 62%, 50% 100%, 0% 62%, 0% 20%)' } },
  { id: 'star',    label: 'Star',    style: { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' } },
  { id: 'hexagon', label: 'Hexagon', style: { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' } },
  { id: 'ribbon',  label: 'Ribbon',  style: { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 50% 80%, 18% 100%, 0% 38%)' } },
]
const COLOURS = [
  { id: 'gold',   label: 'Gold',   from: '#f6e27a', to: '#c9982a' },
  { id: 'silver', label: 'Silver', from: '#eef1f5', to: '#9aa3ad' },
  { id: 'bronze', label: 'Bronze', from: '#e6b085', to: '#a05a2c' },
  { id: 'teal',   label: 'Teal',   from: '#7fe9d8', to: '#0d9488' },
  { id: 'purple', label: 'Purple', from: '#d3c2fb', to: '#7c3aed' },
  { id: 'pink',   label: 'Pink',   from: '#fbd0e8', to: '#db2777' },
]
const SYMBOLS = [
  { id: 'star',    label: 'Star',    glyph: '⭐' },
  { id: 'medal',   label: 'Medal',   glyph: '🥇' },
  { id: 'flame',   label: 'Flame',   glyph: '🔥' },
  { id: 'trophy',  label: 'Trophy',  glyph: '🏆' },
  { id: 'heart',   label: 'Heart',   glyph: '❤️' },
  { id: 'crown',   label: 'Crown',   glyph: '👑' },
  { id: 'sparkle', label: 'Sparkle', glyph: '✨' },
  { id: 'target',  label: 'Target',  glyph: '🎯' },
]
// A badge's `type` (Milestone vs Game) is fixed by which trigger it uses —
// "finishes a specific game" is the only trigger tied to one game, so it's
// the only one that counts as a "Game badge" for filtering/stats.
const TRIGGERS = [
  { id: 'first-game',    label: 'finishes any game for the first time', type: 'Milestone', needsGame: false },
  { id: 'specific-game', label: 'finishes a specific game',             type: 'Game',      needsGame: true },
  { id: 'streak',        label: 'plays 7 days in a row',                type: 'Milestone', needsGame: false },
  { id: 'perfect-score', label: 'gets every answer right on the first try', type: 'Milestone', needsGame: false },
]

const emptyForm = {
  name: '', shape: 'circle', colour: 'gold', symbol: 'star',
  trigger: 'first-game', gameId: null, unlocksPaoItem: '', status: 'Active',
}

function ruleClause(form, games) {
  const trig = TRIGGERS.find((t) => t.id === form.trigger) || TRIGGERS[0]
  if (trig.id === 'specific-game') {
    const game = games.find((g) => g.id === form.gameId)
    return `Finishes ${game ? game.name : 'a specific game'}`
  }
  if (trig.id === 'first-game') return 'Finishes any game for the first time'
  if (trig.id === 'streak') return 'Plays 7 days in a row'
  if (trig.id === 'perfect-score') return 'Gets every answer right on the first try'
  return trig.label
}

function fullDescription(badge, games) {
  const base = ruleClause(badge, games)
  const item = PAO_ITEMS.find((i) => i.id === badge.unlocksPaoItem)
  return item ? `${base} · unlocks ${item.name}` : base
}

/* ── Badge medal (shape + colour + symbol rendered together) ── */
function BadgeMedal({ shape, colour, symbol, size = 40 }) {
  const shp = SHAPES.find((s) => s.id === shape) || SHAPES[0]
  const col = COLOURS.find((c) => c.id === colour) || COLOURS[0]
  const sym = SYMBOLS.find((s) => s.id === symbol) || SYMBOLS[0]
  return (
    <span
      className="badge-medal"
      style={{ width: size, height: size, fontSize: size * 0.5, background: `linear-gradient(135deg, ${col.from}, ${col.to})`, ...shp.style }}
      aria-hidden="true"
    >
      {sym.glyph}
    </span>
  )
}

/* ── One row of pick-a-swatch options ── */
function SwatchField({ label, options, value, onChange, renderSwatch }) {
  const selected = options.find((o) => o.id === value)
  return (
    <div className="badge-swatch-field">
      <div className="badge-swatch-head">
        <span>{label}</span>
        <span className="badge-swatch-selected">{selected?.label}</span>
      </div>
      <div className="badge-swatch-row">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`badge-swatch${value === opt.id ? ' selected' : ''}`}
            onClick={() => onChange(opt.id)}
            title={opt.label}
            aria-label={opt.label}
          >
            {renderSwatch(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

const FILTERS = ['All', 'Game badges', 'Milestones', 'Hidden']

export default function GamifiedBadgesPage({ user, onLogout }) {
  const [badges, setBadges] = useState(initialBadges)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const editingBadge = useMemo(() => badges.find((badge) => badge.id === editingId) || null, [badges, editingId])

  const stats = useMemo(() => {
    const active = badges.filter((b) => b.status === 'Active')
    const hidden = badges.filter((b) => b.status === 'Hidden')
    const gameBadges = badges.filter((b) => b.type === 'Game')
    const timesEarned = badges.reduce((sum, b) => sum + Number(b.earnedCount || 0), 0)
    return { total: badges.length, active: active.length, hidden: hidden.length, gameBadges: gameBadges.length, timesEarned }
  }, [badges])

  const filterCounts = useMemo(() => ({
    All: badges.length,
    'Game badges': badges.filter((b) => b.type === 'Game').length,
    Milestones: badges.filter((b) => b.type === 'Milestone').length,
    Hidden: badges.filter((b) => b.status === 'Hidden').length,
  }), [badges])

  const visibleBadges = useMemo(() => {
    if (statusFilter === 'All') return badges
    if (statusFilter === 'Game badges') return badges.filter((b) => b.type === 'Game')
    if (statusFilter === 'Milestones') return badges.filter((b) => b.type === 'Milestone')
    return badges.filter((b) => b.status === 'Hidden')
  }, [badges, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowEditor(true)
  }

  const openEdit = (badge) => {
    setEditingId(badge.id)
    setForm({
      name: badge.name, shape: badge.shape, colour: badge.colour, symbol: badge.symbol,
      trigger: badge.trigger, gameId: badge.gameId, unlocksPaoItem: badge.unlocksPaoItem || '', status: badge.status,
    })
    setShowEditor(true)
  }

  const shuffleAppearance = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id
    setForm((f) => ({ ...f, shape: pick(SHAPES), colour: pick(COLOURS), symbol: pick(SYMBOLS) }))
  }

  const saveBadge = (event) => {
    event.preventDefault()
    const trig = TRIGGERS.find((t) => t.id === form.trigger) || TRIGGERS[0]
    const payload = {
      name: form.name, shape: form.shape, colour: form.colour, symbol: form.symbol,
      trigger: form.trigger, type: trig.type,
      gameId: trig.needsGame ? form.gameId : null,
      unlocksPaoItem: form.unlocksPaoItem || null,
      status: form.status,
    }
    if (editingBadge) {
      setBadges((current) => current.map((badge) => (badge.id === editingBadge.id ? { ...badge, ...payload } : badge)))
    } else {
      setBadges((current) => [...current, { id: Date.now(), earnedCount: 0, ...payload }])
    }
    setShowEditor(false)
  }

  const toggleVisibility = (badge) => {
    setBadges((current) => current.map((b) => (b.id === badge.id ? { ...b, status: b.status === 'Active' ? 'Hidden' : 'Active' } : b)))
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setBadges((current) => current.filter((badge) => badge.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Badges"
      subtitle="Create and manage badges patients can unlock"
      icon={<MedalIcon />}
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid badge-kpi-grid">
        <section className="badge-kpi-card">
          <span className="badge-kpi-icon badge-kpi-icon-total"><MedalIcon size={20} /></span>
          <div className="badge-kpi-text">
            <h3>{stats.total}</h3>
            <p>Total badges</p>
            <span className="badge-kpi-meta">In the library</span>
          </div>
        </section>
        <section className="badge-kpi-card">
          <span className="badge-kpi-icon badge-kpi-icon-active"><EyeIcon size={18} /></span>
          <div className="badge-kpi-text">
            <h3>{stats.active}</h3>
            <p>Active</p>
            <span className="badge-kpi-meta">Visible to patients</span>
          </div>
        </section>
        <section className="badge-kpi-card">
          <span className="badge-kpi-icon badge-kpi-icon-hidden"><EyeOffIcon size={18} /></span>
          <div className="badge-kpi-text">
            <h3>{stats.hidden}</h3>
            <p>Hidden</p>
            <span className="badge-kpi-meta">Not yet visible</span>
          </div>
        </section>
        <section className="badge-kpi-card">
          <span className="badge-kpi-icon badge-kpi-icon-game"><GameControllerIcon size={18} /></span>
          <div className="badge-kpi-text">
            <h3>{stats.gameBadges}</h3>
            <p>Game badges</p>
            <span className="badge-kpi-meta">One per game</span>
          </div>
        </section>
        <section className="badge-kpi-card">
          <span className="badge-kpi-icon badge-kpi-icon-earned"><UsersIcon size={18} /></span>
          <div className="badge-kpi-text">
            <h3>{stats.timesEarned}</h3>
            <p>Times earned</p>
            <span className="badge-kpi-meta">Across all patients</span>
          </div>
        </section>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Badge library</h3>
            <p>Reward patients for milestones and consistent practice</p>
          </div>
          <button className="admin-btn" onClick={openCreate}>Add badge</button>
        </div>

        <div className="admin-toolbar" style={{ marginBottom: '16px' }}>
          <div className="admin-button-row">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={statusFilter === filter ? 'admin-btn' : 'admin-btn-secondary'}
                onClick={() => setStatusFilter(filter)}
              >
                {filter} <span className="badge-filter-count">{filterCounts[filter]}</span>
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
                  <BadgeMedal shape={badge.shape} colour={badge.colour} symbol={badge.symbol} size={36} />
                  <h4>{badge.name}</h4>
                  <span className={`admin-pill ${badge.status === 'Active' ? 'green' : 'gray'}`}>{badge.status}</span>
                  <span className={`admin-pill ${badge.type === 'Game' ? 'blue' : 'purple'}`}>{badge.type}</span>
                </div>
                <p>{fullDescription(badge, initialGames)}</p>
                <div className="badge-earned-line">
                  <UsersIcon size={13} /> Earned by {badge.earnedCount} patient{badge.earnedCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="admin-item-actions">
                <button className="admin-icon-btn" onClick={() => toggleVisibility(badge)} title={badge.status === 'Active' ? 'Hide from patients' : 'Show to patients'} aria-label={badge.status === 'Active' ? `Hide ${badge.name}` : `Show ${badge.name}`}>
                  {badge.status === 'Active' ? <EyeIcon /> : <EyeOffIcon />}
                </button>
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
          <div className="admin-modal badge-builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon"><MedalIcon /></span>
                <div>
                  <h3>{editingBadge ? 'Edit badge' : 'New badge'}</h3>
                  <p>Design the medal, then set the rule that awards it.</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setShowEditor(false)} aria-label="Close">✕</button>
            </div>

            <form className="admin-modal-form badge-builder-body" onSubmit={saveBadge}>
              <div className="badge-preview-card">
                <BadgeMedal shape={form.shape} colour={form.colour} symbol={form.symbol} size={72} />
                <div className="badge-preview-name">{form.name || 'Untitled badge'}</div>
                <div className="badge-preview-rule">{ruleClause(form, initialGames)}</div>
                <button type="button" className="badge-shuffle-btn" onClick={shuffleAppearance}>
                  <ShuffleIcon size={13} /> Shuffle
                </button>
              </div>

              <div className="badge-builder-fields">
                <label className="admin-field">
                  <span>Badge name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Word Wizard"
                    required
                  />
                </label>

                <SwatchField
                  label="Shape" options={SHAPES} value={form.shape}
                  onChange={(id) => setForm((f) => ({ ...f, shape: id }))}
                  renderSwatch={(opt) => <span className="badge-swatch-shape" style={opt.style} />}
                />
                <SwatchField
                  label="Colour" options={COLOURS} value={form.colour}
                  onChange={(id) => setForm((f) => ({ ...f, colour: id }))}
                  renderSwatch={(opt) => <span className="badge-swatch-colour" style={{ background: `linear-gradient(135deg, ${opt.from}, ${opt.to})` }} />}
                />
                <SwatchField
                  label="Symbol" options={SYMBOLS} value={form.symbol}
                  onChange={(id) => setForm((f) => ({ ...f, symbol: id }))}
                  renderSwatch={(opt) => <span className="badge-swatch-symbol">{opt.glyph}</span>}
                />

                <label className="admin-field">
                  <span>Award once, when the patient…</span>
                  <select
                    value={form.trigger}
                    onChange={(event) => {
                      const nextTrigger = event.target.value
                      const needsGame = TRIGGERS.find((t) => t.id === nextTrigger)?.needsGame
                      setForm((f) => ({ ...f, trigger: nextTrigger, gameId: needsGame ? (f.gameId ?? initialGames[0]?.id) : null }))
                    }}
                  >
                    {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>

                {TRIGGERS.find((t) => t.id === form.trigger)?.needsGame && (
                  <label className="admin-field">
                    <span>Which game</span>
                    <select
                      value={form.gameId ?? ''}
                      onChange={(event) => setForm((f) => ({ ...f, gameId: Number(event.target.value) }))}
                    >
                      {initialGames.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                )}

                <label className="admin-field">
                  <span>Unlocks item for Pao</span>
                  <select
                    value={form.unlocksPaoItem}
                    onChange={(event) => setForm((f) => ({ ...f, unlocksPaoItem: event.target.value }))}
                  >
                    <option value="">None</option>
                    {PAO_ITEM_CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={cat}>
                        {PAO_ITEMS.filter((i) => i.category === cat).map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label className="admin-field admin-field-checkbox">
                  <input
                    type="checkbox"
                    checked={form.status === 'Active'}
                    onChange={(event) => setForm((f) => ({ ...f, status: event.target.checked ? 'Active' : 'Hidden' }))}
                  />
                  <span>Visible to patients</span>
                </label>
              </div>

              <div className="admin-button-row badge-builder-actions">
                <button className="admin-btn" type="submit">{editingBadge ? 'Save changes' : 'Save badge'}</button>
                <button className="admin-btn-secondary" type="button" onClick={() => setShowEditor(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon" style={{ color: '#b45309' }}><TrashIcon size={32} /></div>
            <h3 className="admin-confirm-title">Delete badge?</h3>
            <p className="admin-confirm-msg">
              This will permanently remove <strong>{deleteTarget.name}</strong> from the badge library. This cannot be undone.
            </p>
            <div className="admin-confirm-actions">
              <button className="admin-confirm-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="admin-confirm-ok" onClick={confirmDelete}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
