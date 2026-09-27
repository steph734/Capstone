import { useEffect, useId, useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { initialGames } from './gamifiedLibraryData'
import { PAO_ITEMS, PAO_ITEM_CATEGORIES } from '../../data/paoItems'
import {
  MedalIcon, PencilIcon, TrashIcon, EyeIcon, EyeOffIcon, UsersIcon,
  ShuffleIcon, GameControllerIcon, ShirtIcon,
} from './gamifiedIcons'
import PandaMascot from '../games/PandaMascot'
import {
  STYLE_OPTIONS, SLOT_ICONS, COLOURS as CLOTHING_COLOURS, PATTERNS, STICKERS,
  colourHex, patternBackgroundStyle, ClothingPreviewIcon,
} from './clothingBuilderData'
import './GamifiedBadgesPage.css'

/* ── Badge design options — enums mirror the `badges` collection's
   $jsonSchema exactly, since Mongo will reject anything outside them. ── */

/* CSS clip-path percentages, for the small flat swatch buttons in the
   picker (kept simple/cheap — the real medal render below uses SVG). */
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

/* Absolute SVG coordinates (not %), for the actual medal outline in
   BadgeMedal — a real <svg> shape rather than a CSS clip-path, since the
   medal also needs ribbon tails layered behind it. */
function polygonSvgPoints(sides, cx, cy, r, rotate = -90) {
  const pts = []
  for (let i = 0; i < sides; i++) {
    const angle = (rotate + (360 / sides) * i) * (Math.PI / 180)
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`)
  }
  return pts.join(' ')
}
function starSvgPoints(points, cx, cy, r, innerRatio = 0.5, rotate = -90) {
  const pts = []
  const step = 360 / (points * 2)
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * innerRatio
    const angle = (rotate + step * i) * (Math.PI / 180)
    pts.push(`${(cx + rad * Math.cos(angle)).toFixed(1)},${(cy + rad * Math.sin(angle)).toFixed(1)}`)
  }
  return pts.join(' ')
}

const SHAPES = [
  {
    id: 'circle', label: 'Circle', swatchStyle: { borderRadius: '50%' },
    outline: (cx, cy, r) => <circle cx={cx} cy={cy} r={r} />,
  },
  {
    id: 'rounded', label: 'Rounded', swatchStyle: { borderRadius: '22%' },
    outline: (cx, cy, r) => <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={r * 0.4} ry={r * 0.4} />,
  },
  {
    id: 'octagon', label: 'Octagon', swatchStyle: { clipPath: polygonPoints(8) },
    outline: (cx, cy, r) => <polygon points={polygonSvgPoints(8, cx, cy, r)} />,
  },
  {
    id: 'hexagon', label: 'Hexagon', swatchStyle: { clipPath: polygonPoints(6) },
    outline: (cx, cy, r) => <polygon points={polygonSvgPoints(6, cx, cy, r)} />,
  },
  {
    id: 'diamond', label: 'Diamond', swatchStyle: { clipPath: polygonPoints(4) },
    outline: (cx, cy, r) => <polygon points={polygonSvgPoints(4, cx, cy, r)} />,
  },
  {
    id: 'shield', label: 'Shield', swatchStyle: { clipPath: 'polygon(50% 0%, 100% 20%, 100% 62%, 50% 100%, 0% 62%, 0% 20%)' },
    outline: (cx, cy, r) => <polygon points={`${cx - r},${cy - r} ${cx + r},${cy - r} ${cx + r},${cy + 0.24 * r} ${cx},${cy + r} ${cx - r},${cy + 0.24 * r}`} />,
  },
  {
    id: 'star', label: 'Star', swatchStyle: { clipPath: starPolygon(5, 0.5) },
    outline: (cx, cy, r) => <polygon points={starSvgPoints(5, cx, cy, r, 0.5)} />,
  },
  {
    id: 'flower', label: 'Flower', swatchStyle: { clipPath: starPolygon(8, 0.72) },
    outline: (cx, cy, r) => <polygon points={starSvgPoints(8, cx, cy, r, 0.72)} />,
  },
  {
    id: 'scallop', label: 'Scallop', swatchStyle: { clipPath: starPolygon(12, 0.86) },
    outline: (cx, cy, r) => <polygon points={starSvgPoints(12, cx, cy, r, 0.88)} />,
  },
  {
    id: 'gear', label: 'Gear', swatchStyle: { clipPath: starPolygon(10, 0.8) },
    outline: (cx, cy, r) => <polygon points={starSvgPoints(10, cx, cy, r, 0.82)} />,
  },
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
function describeForSave(form, clothesList) {
  const base = ruleClause(form)
  const item = clothesList.find((i) => i.id === form.unlockItemCode)
  return item ? `${base} · unlocks ${item.name}` : base
}

const emptyForm = {
  name: '', shape: 'circle', colour: 'gold', symbol: 'star',
  criteriaType: 'complete_any_game', criteriaGameId: null, criteriaValue: null,
  unlockItemCode: '', isActive: true,
}

const emptyClothingForm = {
  name: '', category: 'Hair', style: 'beanie',
  mainColour: 'blue', trimColour: 'yellow',
  pattern: 'solid', patternColour: 'white', sticker: 'none',
}

function slugifyLocal(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item'
}

/* ── Badge medal: a real award-ribbon icon (shape + colour + symbol),
   not just a flat colored blob — two ribbon tails behind a medallion,
   with an inner rim and the symbol centered on top. `muted` renders a
   hidden/not-yet-earned badge washed out, same idea as a grayed-out
   trophy case slot. ── */
function BadgeMedal({ shape, colour, symbol, size = 40, muted = false }) {
  const shp = SHAPES.find((s) => s.id === shape) || SHAPES[0]
  const col = COLOURS.find((c) => c.id === colour) || COLOURS[0]
  const sym = SYMBOLS.find((s) => s.id === symbol) || SYMBOLS[0]
  const gradId = useId()
  // The medallion (upper ~55% of the viewBox) is the part a viewer reads as
  // the icon's "center" — nudge the whole element down a little so that
  // part, not the ribbon-tail-inclusive bounding box, lines up with
  // sibling text when this sits in a flex row with align-items: center.
  const nudge = size * 0.17

  return (
    <svg
      className={`badge-medal-svg${muted ? ' muted' : ''}`}
      width={size}
      height={size * 1.3}
      viewBox="0 0 100 128"
      style={{ overflow: 'visible', flexShrink: 0, transform: `translateY(${nudge}px)` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor={col.from} />
          <stop offset="100%" stopColor={col.to} />
        </linearGradient>
      </defs>
      {/* Ribbon tails, tucked behind the medallion */}
      <polygon points="34,72 46,72 46,120 40,106 34,120" fill={col.to} />
      <polygon points="54,72 66,72 66,120 60,106 54,120" fill={col.to} />
      {/* Medallion */}
      <g fill={`url(#${gradId})`} stroke="rgba(0,0,0,0.15)" strokeWidth="1.5">
        {shp.outline(50, 44, 36)}
      </g>
      <circle cx="50" cy="44" r="28" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
      <text x="50" y="45" textAnchor="middle" dominantBaseline="central" fontSize="30">{sym.glyph}</text>
    </svg>
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
  const [pageTab, setPageTab] = useState('Badges') // 'Badges' | 'Clothes'

  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Pao's wardrobe catalog — local-only (no schema was given for this one,
  // unlike badges), same as how the game catalog on Assign Exercises works.
  // Seeded from src/data/paoItems.js, which also mirrors the real item
  // ids/names a patient sees in PaoCustomizePage.jsx.
  const [clothes, setClothes] = useState(PAO_ITEMS)
  const [clothesFilter, setClothesFilter] = useState('All')
  const [editingClothingId, setEditingClothingId] = useState(null)
  const [showClothingEditor, setShowClothingEditor] = useState(false)
  const [clothingForm, setClothingForm] = useState(emptyClothingForm)

  // { kind: 'badge' | 'clothing', item } while a delete confirmation is open.
  const [deleteTarget, setDeleteTarget] = useState(null)

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
      description: describeForSave(form, clothes),
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

  const confirmDeleteBadge = async (badge) => {
    try {
      const res = await fetch(`/api/badges/${badge.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setBadges((current) => current.filter((b) => b.id !== badge.id))
    } catch (err) {
      showToast(err.message || 'Could not delete the badge.')
    }
  }

  const activeCriteria = CRITERIA_TYPES.find((t) => t.id === form.criteriaType) || CRITERIA_TYPES[0]

  /* ── Clothes (Pao wardrobe) ── */
  const CLOTHES_FILTERS = ['All', ...PAO_ITEM_CATEGORIES]

  const clothesFilterCounts = useMemo(() => ({
    All: clothes.length,
    ...Object.fromEntries(PAO_ITEM_CATEGORIES.map((cat) => [cat, clothes.filter((c) => c.category === cat).length])),
  }), [clothes])

  const visibleClothes = useMemo(() => {
    if (clothesFilter === 'All') return clothes
    return clothes.filter((c) => c.category === clothesFilter)
  }, [clothes, clothesFilter])

  const editingClothing = useMemo(() => clothes.find((c) => c.id === editingClothingId) || null, [clothes, editingClothingId])

  const openCreateClothing = () => {
    setEditingClothingId(null)
    setClothingForm(emptyClothingForm)
    setShowClothingEditor(true)
  }

  const openEditClothing = (item) => {
    setEditingClothingId(item.id)
    setClothingForm({
      name: item.name, category: item.category, style: item.style,
      mainColour: item.mainColour, trimColour: item.trimColour,
      pattern: item.pattern, patternColour: item.patternColour, sticker: item.sticker,
    })
    setShowClothingEditor(true)
  }

  const saveClothing = (event) => {
    event.preventDefault()
    if (editingClothing) {
      setClothes((current) => current.map((c) => (c.id === editingClothing.id ? { ...c, ...clothingForm } : c)))
    } else {
      const base = slugifyLocal(clothingForm.name)
      let candidate = base
      let n = 2
      while (clothes.some((c) => c.id === candidate)) {
        candidate = `${base}_${n}`
        n += 1
      }
      setClothes((current) => [...current, { id: candidate, ...clothingForm }])
    }
    setShowClothingEditor(false)
  }

  const deleteClothingItem = (item) => {
    setClothes((current) => current.filter((c) => c.id !== item.id))
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'badge') confirmDeleteBadge(deleteTarget.item)
    else deleteClothingItem(deleteTarget.item)
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
      <div className="badges-page-tabs">
        <button
          type="button"
          className={pageTab === 'Badges' ? 'active' : ''}
          onClick={() => setPageTab('Badges')}
        >
          <MedalIcon size={16} /> Badges
        </button>
        <button
          type="button"
          className={pageTab === 'Clothes' ? 'active' : ''}
          onClick={() => setPageTab('Clothes')}
        >
          <ShirtIcon size={16} /> Clothes
        </button>
      </div>

      {pageTab === 'Badges' && (
      loading ? (
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
                  <BadgeMedal shape={badge.shape} colour={badge.colour} symbol={badge.symbol} size={36} muted={!badge.isActive} />
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
                <button className="admin-icon-btn admin-icon-delete" onClick={() => setDeleteTarget({ kind: 'badge', item: badge })} title="Delete" aria-label={`Delete ${badge.name}`}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )
      )}

      {pageTab === 'Clothes' && (
      <>
      <div className="admin-stats-grid badge-kpi-grid">
        <section className="badge-kpi-card">
          <span className="badge-kpi-icon badge-kpi-icon-total"><ShirtIcon size={18} /></span>
          <div className="badge-kpi-text">
            <h3>{clothesFilterCounts.All}</h3>
            <p>Total items</p>
            <span className="badge-kpi-meta">In the wardrobe</span>
          </div>
        </section>
        {PAO_ITEM_CATEGORIES.map((cat) => (
          <section className="badge-kpi-card" key={cat}>
            <span className="badge-kpi-icon badge-kpi-icon-active"><ShirtIcon size={18} /></span>
            <div className="badge-kpi-text">
              <h3>{clothesFilterCounts[cat]}</h3>
              <p>{cat}</p>
              <span className="badge-kpi-meta">Unlockable items</span>
            </div>
          </section>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Pao's wardrobe</h3>
            <p>Cosmetic items badges can unlock for Pao</p>
          </div>
          <button className="admin-btn" onClick={openCreateClothing}>Design new item</button>
        </div>

        <div className="admin-toolbar" style={{ marginBottom: '16px' }}>
          <div className="admin-button-row">
            {CLOTHES_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={clothesFilter === filter ? 'admin-btn' : 'admin-btn-secondary'}
                onClick={() => setClothesFilter(filter)}
              >
                {filter} <span className="badge-filter-count">{clothesFilterCounts[filter]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="clothing-grid">
          {visibleClothes.length === 0 && (
            <div className="game-card">
              <div>
                <h4>No items found</h4>
                <p>Try a different filter or design a new item.</p>
              </div>
            </div>
          )}
          {visibleClothes.map((item) => (
            <div key={item.id} className="clothing-card">
              <ClothingPreviewIcon {...item} size={72} />
              <h4>{item.name}</h4>
              <span className="admin-pill gray">{item.category}</span>
              <div className="admin-item-actions">
                <button className="admin-icon-btn admin-icon-edit" onClick={() => openEditClothing(item)} title="Edit" aria-label={`Edit ${item.name}`}>
                  <PencilIcon />
                </button>
                <button className="admin-icon-btn admin-icon-delete" onClick={() => setDeleteTarget({ kind: 'clothing', item })} title="Delete" aria-label={`Delete ${item.name}`}>
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
                <BadgeMedal shape={form.shape} colour={form.colour} symbol={form.symbol} size={72} muted={!form.isActive} />
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
                  renderSwatch={(opt) => <span className="badge-swatch-shape" style={opt.swatchStyle} />}
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
                        {clothes.filter((i) => i.category === cat).map((i) => (
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

      {showClothingEditor && (
        <div className="admin-modal-backdrop" onClick={() => setShowClothingEditor(false)}>
          <div className="admin-modal clothing-builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon"><ShirtIcon /></span>
                <div>
                  <h3>{editingClothing ? 'Edit clothing item' : 'Design a clothing item'}</h3>
                  <p>Pick a style, colours and a sticker — Pao tries it on as you go.</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={() => setShowClothingEditor(false)} aria-label="Close">✕</button>
            </div>

            <form onSubmit={saveClothing} className="clothing-builder-body">
              <div className="clothing-preview-col">
                <div className="clothing-pao-frame">
                  <PandaMascot pxWidth={140} pandaState="happy" />
                </div>
                <div className="clothing-preview-card">
                  <ClothingPreviewIcon {...clothingForm} size={56} />
                  <div>
                    <h4>{clothingForm.name || 'Untitled item'}</h4>
                    <p>{clothingForm.category}</p>
                  </div>
                </div>
              </div>

              <div className="clothing-builder-fields">
                <div className="clothing-builder-section">
                  <span className="clothing-section-label"><em>1</em> Name &amp; slot</span>
                  <label className="admin-field">
                    <span>Item name</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Starry Beanie"
                      value={clothingForm.name}
                      onChange={(event) => setClothingForm((f) => ({ ...f, name: event.target.value }))}
                    />
                  </label>
                  <div className="clothing-slot-row">
                    {PAO_ITEM_CATEGORIES.map((cat) => {
                      const SlotIcon = SLOT_ICONS[cat]
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`clothing-slot-btn${clothingForm.category === cat ? ' selected' : ''}`}
                          onClick={() => setClothingForm((f) => ({ ...f, category: cat, style: STYLE_OPTIONS[cat][0].id }))}
                        >
                          <SlotIcon size={20} />
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="clothing-builder-section">
                  <span className="clothing-section-label"><em>2</em> Style</span>
                  <div className="clothing-style-row">
                    {STYLE_OPTIONS[clothingForm.category].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`clothing-style-btn${clothingForm.style === opt.id ? ' selected' : ''}`}
                        onClick={() => setClothingForm((f) => ({ ...f, style: opt.id }))}
                      >
                        <opt.Icon size={22} />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="clothing-builder-section">
                  <span className="clothing-section-label"><em>3</em> Colours</span>
                  <SwatchField
                    label="Main colour" options={CLOTHING_COLOURS} value={clothingForm.mainColour}
                    onChange={(id) => setClothingForm((f) => ({ ...f, mainColour: id }))}
                    renderSwatch={(opt) => <span className="badge-swatch-colour" style={{ background: opt.hex }} />}
                  />
                  <SwatchField
                    label="Trim colour" options={CLOTHING_COLOURS} value={clothingForm.trimColour}
                    onChange={(id) => setClothingForm((f) => ({ ...f, trimColour: id }))}
                    renderSwatch={(opt) => <span className="badge-swatch-colour" style={{ background: opt.hex }} />}
                  />
                </div>

                <div className="clothing-builder-section">
                  <span className="clothing-section-label"><em>4</em> Pattern</span>
                  <div className="clothing-style-row">
                    {PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`clothing-style-btn${clothingForm.pattern === p.id ? ' selected' : ''}`}
                        onClick={() => setClothingForm((f) => ({ ...f, pattern: p.id }))}
                      >
                        <span className="clothing-pattern-swatch" style={patternBackgroundStyle(p.id, colourHex(clothingForm.patternColour)) || { background: colourHex(clothingForm.mainColour) }} />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {clothingForm.pattern !== 'solid' && (
                    <SwatchField
                      label="Pattern colour" options={CLOTHING_COLOURS} value={clothingForm.patternColour}
                      onChange={(id) => setClothingForm((f) => ({ ...f, patternColour: id }))}
                      renderSwatch={(opt) => <span className="badge-swatch-colour" style={{ background: opt.hex }} />}
                    />
                  )}
                </div>

                <div className="clothing-builder-section">
                  <span className="clothing-section-label"><em>5</em> Sticker</span>
                  <div className="clothing-style-row">
                    {STICKERS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`clothing-style-btn${clothingForm.sticker === s.id ? ' selected' : ''}`}
                        onClick={() => setClothingForm((f) => ({ ...f, sticker: s.id }))}
                      >
                        <span className="clothing-sticker-glyph">{s.glyph || '—'}</span>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="admin-button-row badge-builder-actions">
                  <button className="admin-btn" type="submit">{editingClothing ? 'Save changes' : 'Add item'}</button>
                  <button className="admin-btn-secondary" type="button" onClick={() => setShowClothingEditor(false)}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-confirm-icon" style={{ color: '#b45309' }}><TrashIcon size={32} /></div>
            <h3 className="admin-confirm-title">{deleteTarget.kind === 'badge' ? 'Delete badge?' : 'Delete clothing item?'}</h3>
            <p className="admin-confirm-msg">
              This will permanently remove <strong>{deleteTarget.item.name}</strong>{' '}
              {deleteTarget.kind === 'badge' ? 'from the badge library' : "from Pao's wardrobe"}. This cannot be undone.
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
