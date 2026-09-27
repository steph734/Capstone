import { useEffect, useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGames } from './gamifiedLibraryData'
import { PAO_ITEMS, PAO_ITEM_CATEGORIES } from '../../data/paoItems'
import {
  MedalIcon, PencilIcon, TrashIcon, EyeIcon, EyeOffIcon, UsersIcon,
  ShuffleIcon, GameControllerIcon,
} from './gamifiedIcons'
import './GamifiedBadgesPage.css'

/* ── Badge design options — enums mirror the `badges` collection's
   $jsonSchema exactly, since Mongo will reject anything outside them. ── */
function polygonPoints(sides, rotate = -90) {
  const pts = []
  for (let i = 0; i < sides; i++) {
    const angle = (rotate + (360 / sides) * i) * (Math.PI / 180)
    pts.push(`${(50 + 50 * Math.cos(angle)).toFixed(1)}% ${(50 + 50 * Math.sin(angle)).toFixed(1)}%`)
  }
  return `polygon(${pts.join(', ')})`
}
function starPolygon(points, innerRatio = 0.5, rotate = -90) {
  const pts = []
  const step = 360 / (points * 2)
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * innerRatio
    const angle = (rotate + step * i) * (Math.PI / 180)
    pts.push(`${(50 + r * Math.cos(angle)).toFixed(1)}% ${(50 + r * Math.sin(angle)).toFixed(1)}%`)
  }
  return `polygon(${pts.join(', ')})`
}

const SHAPES = [
  { id: 'circle',  label: 'Circle',  style: { borderRadius: '50%' } },
  { id: 'rounded', label: 'Rounded', style: { borderRadius: '22%' } },
  { id: 'octagon', label: 'Octagon', style: { clipPath: polygonPoints(8) } },
  { id: 'hexagon', label: 'Hexagon', style: { clipPath: polygonPoints(6) } },
  { id: 'diamond', label: 'Diamond', style: { clipPath: polygonPoints(4) } },
  { id: 'shield',  label: 'Shield',  style: { clipPath: 'polygon(50% 0%, 100% 20%, 100% 62%, 50% 100%, 0% 62%, 0% 20%)' } },
  { id: 'star',    label: 'Star',    style: { clipPath: starPolygon(5, 0.5) } },
  { id: 'flower',  label: 'Flower',  style: { clipPath: starPolygon(8, 0.72) } },
  { id: 'scallop', label: 'Scallop', style: { clipPath: starPolygon(12, 0.86) } },
  { id: 'gear',    label: 'Gear',    style: { clipPath: starPolygon(10, 0.8) } },
]
const COLOURS = [
  { id: 'gold',   label: 'Gold',   from: '#f6e27a', to: '#c9982a' },
  { id: 'silver', label: 'Silver', from: '#eef1f5', to: '#9aa3ad' },
  { id: 'bronze', label: 'Bronze', from: '#e6b085', to: '#a05a2c' },
  { id: 'red',    label: 'Red',    from: '#fca5a5', to: '#dc2626' },
  { id: 'orange', label: 'Orange', from: '#fdba74', to: '#ea580c' },
  { id: 'amber',  label: 'Amber',  from: '#fde68a', to: '#d97706' },
  { id: 'green',  label: 'Green',  from: '#86efac', to: '#16a34a' },
  { id: 'teal',   label: 'Teal',   from: '#7fe9d8', to: '#0d9488' },
  { id: 'blue',   label: 'Blue',   from: '#93c5fd', to: '#2563eb' },
  { id: 'indigo', label: 'Indigo', from: '#a5b4fc', to: '#4338ca' },
  { id: 'purple', label: 'Purple', from: '#d3c2fb', to: '#7c3aed' },
  { id: 'pink',   label: 'Pink',   from: '#fbd0e8', to: '#db2777' },
]
const SYMBOLS = [
  { id: 'star',   label: 'Star',   glyph: '⭐' }, { id: 'heart',  label: 'Heart',  glyph: '❤️' },
  { id: 'leaf',   label: 'Leaf',   glyph: '🍃' }, { id: 'drop',   label: 'Drop',   glyph: '💧' },
  { id: 'trophy', label: 'Trophy', glyph: '🏆' }, { id: 'bolt',   label: 'Bolt',   glyph: '⚡' },
  { id: 'crown',  label: 'Crown',  glyph: '👑' }, { id: 'flake',  label: 'Flake',  glyph: '❄️' },
  { id: 'brain',  label: 'Brain',  glyph: '🧠' }, { id: 'target', label: 'Target', glyph: '🎯' },
  { id: 'flame',  label: 'Flame',  glyph: '🔥' }, { id: 'book',   label: 'Book',   glyph: '📖' },
  { id: 'rocket', label: 'Rocket', glyph: '🚀' }, { id: 'puzzle', label: 'Puzzle', glyph: '🧩' },
  { id: 'music',  label: 'Music',  glyph: '🎵' }, { id: 'sun',    label: 'Sun',    glyph: '☀️' },
  { id: 'medal',  label: 'Medal',  glyph: '🥇' }, { id: 'shield', label: 'Shield', glyph: '🛡️' },
  { id: 'paw',    label: 'Paw',    glyph: '🐾' }, { id: 'key',    label: 'Key',    glyph: '🔑' },
]
// `badgeType` is fixed by which criteria a badge uses — "finishes a
// specific game" is the only one tied to one game, so it's the only one
// that counts as a game-completion badge.
const CRITERIA_TYPES = [
  { id: 'complete_any_game',      label: 'finishes any game for the first time',     badgeType: 'milestone',       needsGame: false, needsValue: false },
  { id: 'complete_specific_game', label: 'finishes a specific game',                 badgeType: 'game_completion', needsGame: true,  needsValue: false },
  { id: 'perfect_score',          label: 'gets every answer right on the first try', badgeType: 'milestone',       needsGame: false, needsValue: false },
  { id: 'reach_level',            label: 'reaches a specific level',                 badgeType: 'milestone',       needsGame: false, needsValue: true, valueLabel: 'Level', defaultValue: 5 },
  { id: 'total_xp',               label: 'earns a total amount of XP',               badgeType: 'milestone',       needsGame: false, needsValue: true, valueLabel: 'XP points', defaultValue: 500 },
  { id: 'games_in_a_row',         label: 'plays games on consecutive days',          badgeType: 'milestone',       needsGame: false, needsValue: true, valueLabel: 'Days in a row', defaultValue: 7 },
  { id: 'all_categories',         label: 'tries every therapy game category',        badgeType: 'milestone',       needsGame: false, needsValue: false },
]

function ruleClause(form) {
  const c = CRITERIA_TYPES.find((t) => t.id === form.criteriaType) || CRITERIA_TYPES[0]
  if (c.id === 'complete_specific_game') {
    const game = initialGames.find((g) => g.mongoId === form.criteriaGameId)
    return `Finishes ${game ? game.name : 'a specific game'}`
  }
  if (c.id === 'complete_any_game') return 'Finishes any game for the first time'
  if (c.id === 'perfect_score') return 'Gets every answer right on the first try'
  if (c.id === 'reach_level') return `Reaches level ${form.criteriaValue ?? c.defaultValue}`
  if (c.id === 'total_xp') return `Earns ${form.criteriaValue ?? c.defaultValue} XP`
  if (c.id === 'games_in_a_row') return `Plays ${form.criteriaValue ?? c.defaultValue} days in a row`
  if (c.id === 'all_categories') return 'Tries every therapy game category'
  return c.label
}
function describeForSave(form) {
  const base = ruleClause(form)
  const item = PAO_ITEMS.find((i) => i.id === form.unlockItemCode)
  return item ? `${base} · unlocks ${item.name}` : base
}

const emptyForm = {
  name: '', shape: 'circle', colour: 'gold', symbol: 'star',
  criteriaType: 'complete_any_game', criteriaGameId: null, criteriaValue: null,
  unlockItemCode: '', isActive: true,
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
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/badges/list')
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
        if (!cancelled) setBadges(body.badges || [])
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load badges.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200) }

  const editingBadge = useMemo(() => badges.find((badge) => badge.id === editingId) || null, [badges, editingId])

  const stats = useMemo(() => {
    const active = badges.filter((b) => b.isActive)
    const hidden = badges.filter((b) => !b.isActive)
    const gameBadges = badges.filter((b) => b.badgeType === 'game_completion')
    const timesEarned = badges.reduce((sum, b) => sum + Number(b.earnedCount || 0), 0)
    return { total: badges.length, active: active.length, hidden: hidden.length, gameBadges: gameBadges.length, timesEarned }
  }, [badges])

  const filterCounts = useMemo(() => ({
    All: badges.length,
    'Game badges': badges.filter((b) => b.badgeType === 'game_completion').length,
    Milestones: badges.filter((b) => b.badgeType === 'milestone').length,
    Hidden: badges.filter((b) => !b.isActive).length,
  }), [badges])

  const visibleBadges = useMemo(() => {
    if (statusFilter === 'All') return badges
    if (statusFilter === 'Game badges') return badges.filter((b) => b.badgeType === 'game_completion')
    if (statusFilter === 'Milestones') return badges.filter((b) => b.badgeType === 'milestone')
    return badges.filter((b) => !b.isActive)
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
      criteriaType: badge.criteriaType, criteriaGameId: badge.criteriaGameId,
      criteriaValue: badge.criteriaValue, unlockItemCode: badge.unlockItemCode || '', isActive: badge.isActive,
    })
    setShowEditor(true)
  }

  const shuffleAppearance = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id
    setForm((f) => ({ ...f, shape: pick(SHAPES), colour: pick(COLOURS), symbol: pick(SYMBOLS) }))
  }

  const saveBadge = async (event) => {
    event.preventDefault()
    if (saving) return
    const meta = CRITERIA_TYPES.find((t) => t.id === form.criteriaType) || CRITERIA_TYPES[0]
    const payload = {
      name: form.name,
      description: describeForSave(form),
      art: { shape: form.shape, color: form.colour, symbol: form.symbol },
      badgeType: meta.badgeType,
      criteriaType: form.criteriaType,
      criteriaGameId: meta.needsGame ? form.criteriaGameId : null,
      criteriaValue: meta.needsValue ? form.criteriaValue : null,
      unlockItemCode: form.unlockItemCode || null,
      isActive: form.isActive,
      adminEmail: user?.email,
    }
    setSaving(true)
    try {
      const url = editingBadge ? `/api/badges/${editingBadge.id}` : '/api/badges/create'
      const res = await fetch(url, {
        method: editingBadge ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      if (editingBadge) {
        setBadges((current) => current.map((b) => (b.id === editingBadge.id ? body.badge : b)))
      } else {
        setBadges((current) => [...current, body.badge])
      }
      setShowEditor(false)
    } catch (err) {
      showToast(err.message || 'Could not save the badge.')
    } finally {
      setSaving(false)
    }
  }

  const toggleVisibility = async (badge) => {
    const nextActive = !badge.isActive
    setBadges((current) => current.map((b) => (b.id === badge.id ? { ...b, isActive: nextActive } : b)))
    try {
      const res = await fetch(`/api/badges/${badge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      setBadges((current) => current.map((b) => (b.id === badge.id ? { ...b, isActive: !nextActive } : b)))
      showToast(err.message || 'Could not update visibility.')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/badges/${deleteTarget.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setBadges((current) => current.filter((badge) => badge.id !== deleteTarget.id))
    } catch (err) {
      showToast(err.message || 'Could not delete the badge.')
    } finally {
      setDeleteTarget(null)
    }
  }

  const activeCriteria = CRITERIA_TYPES.find((t) => t.id === form.criteriaType) || CRITERIA_TYPES[0]

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Badges"
      subtitle="Create and manage badges patients can unlock"
      icon={<MedalIcon />}
      menuItems={adminMenuItems}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading badges…</p>
      ) : loadError ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{loadError}</p>
      ) : (
      <>
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
                  <span className={`admin-pill ${badge.isActive ? 'green' : 'gray'}`}>{badge.isActive ? 'Active' : 'Hidden'}</span>
                  <span className={`admin-pill ${badge.badgeType === 'game_completion' ? 'blue' : 'purple'}`}>
                    {badge.badgeType === 'game_completion' ? 'Game' : 'Milestone'}
                  </span>
                </div>
                <p>{badge.description}</p>
                <div className="badge-earned-line">
                  <UsersIcon size={13} /> Earned by {badge.earnedCount} patient{badge.earnedCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="admin-item-actions">
                <button className="admin-icon-btn" onClick={() => toggleVisibility(badge)} title={badge.isActive ? 'Hide from patients' : 'Show to patients'} aria-label={badge.isActive ? `Hide ${badge.name}` : `Show ${badge.name}`}>
                  {badge.isActive ? <EyeIcon /> : <EyeOffIcon />}
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
      </>
      )}

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
                <div className="badge-preview-rule">{ruleClause(form)}</div>
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
                    value={form.criteriaType}
                    onChange={(event) => {
                      const nextType = event.target.value
                      const meta = CRITERIA_TYPES.find((t) => t.id === nextType)
                      setForm((f) => ({
                        ...f,
                        criteriaType: nextType,
                        criteriaGameId: meta.needsGame ? (f.criteriaGameId ?? initialGames[0]?.mongoId ?? null) : null,
                        criteriaValue: meta.needsValue ? (f.criteriaValue ?? meta.defaultValue) : null,
                      }))
                    }}
                  >
                    {CRITERIA_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>

                {activeCriteria.needsGame && (
                  <label className="admin-field">
                    <span>Which game</span>
                    <select
                      value={form.criteriaGameId ?? ''}
                      onChange={(event) => setForm((f) => ({ ...f, criteriaGameId: event.target.value }))}
                    >
                      {initialGames.map((g) => <option key={g.mongoId} value={g.mongoId}>{g.name}</option>)}
                    </select>
                  </label>
                )}

                {activeCriteria.needsValue && (
                  <label className="admin-field">
                    <span>{activeCriteria.valueLabel}</span>
                    <input
                      type="number"
                      min="1"
                      value={form.criteriaValue ?? activeCriteria.defaultValue}
                      onChange={(event) => setForm((f) => ({ ...f, criteriaValue: Number(event.target.value) }))}
                    />
                  </label>
                )}

                <label className="admin-field">
                  <span>Unlocks item for Pao</span>
                  <select
                    value={form.unlockItemCode}
                    onChange={(event) => setForm((f) => ({ ...f, unlockItemCode: event.target.value }))}
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
                    checked={form.isActive}
                    onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
                  />
                  <span>Visible to patients</span>
                </label>
              </div>

              <div className="admin-button-row badge-builder-actions">
                <button className="admin-btn" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingBadge ? 'Save changes' : 'Save badge'}
                </button>
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

      {toast && <div className="badge-toast">{toast}</div>}
    </AdminPageShell>
  )
}
