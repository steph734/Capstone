import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check, ChevronDown, Gamepad2, Lock, Search, SlidersHorizontal, X } from 'lucide-react'
import './wardrobe-toolbar.css'

export const STATUS_OPTIONS = [['all', 'All'], ['linked', 'Linked to a game'], ['free', 'Free for everyone'], ['custom', 'Custom design']]
export const SORT_OPTIONS = [['game-asc', 'Game A–Z'], ['game-desc', 'Game Z–A'], ['name-asc', 'Name A–Z'], ['name-desc', 'Name Z–A'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['category', 'Category']]

// A small single-select dropdown with keyboard support (arrows, Enter, Esc) and an optional search box.
function Dropdown({ label, icon: Icon, value, options, onChange, header, searchable, ariaLabel, wide }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const root = useRef(null)
  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()) || o.value === 'all')
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return undefined
    const on = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])

  const choose = (o) => { onChange(o.value); setOpen(false); setQ('') }
  const key = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(shown.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && open && shown[hi]) { e.preventDefault(); choose(shown[hi]) }
  }

  return (
    <div className="wt-dd" ref={root} onKeyDown={key}>
      <button type="button" className="wt-dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => { setOpen((o) => !o); setHi(Math.max(0, shown.findIndex((o) => o.value === value))) }}>
        <Icon size={18} aria-hidden="true" /><span className="wt-dd-label">{label}:</span><strong>{current?.label}</strong><ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className={`wt-dd-menu${wide ? ' wide' : ''}`}>
          {header && <p className="wt-dd-head">{header}</p>}
          {searchable && (
            <label className="wt-dd-search"><Search size={16} aria-hidden="true" /><input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setHi(0) }} placeholder="Search games…" aria-label="Search games" /></label>
          )}
          <ul role="listbox" aria-label={ariaLabel}>
            {shown.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value} className={`${o.value === value ? 'on' : ''}${i === hi ? ' hi' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => choose(o)}>
                <span className="wt-check">{o.value === value && <Check size={16} strokeWidth={3} aria-hidden="true" />}</span>
                <span className="wt-opt">{o.label}</span>
                {o.count != null && <span className="wt-count">{o.count}</span>}
              </li>
            ))}
            {shown.length === 0 && <li className="wt-none">No games found</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

// Search + Game / Status / Sort dropdowns. Phone: search, then a "Filters" button that opens a bottom sheet.
export default function WardrobeToolbar({ filters, setFilters, gameOptions, total }) {
  const [text, setText] = useState(filters.q)
  const [sheet, setSheet] = useState(false)
  useEffect(() => { setText(filters.q) }, [filters.q])
  useEffect(() => {
    if (text === filters.q) return undefined
    const t = setTimeout(() => setFilters({ q: text }), 250) // debounce
    return () => clearTimeout(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const game = (
    <Dropdown label="Game" icon={Gamepad2} ariaLabel="Filter by game" header="UNLOCKED BY GAME" searchable wide
      value={filters.game || 'all'} options={gameOptions} onChange={(v) => setFilters({ game: v === 'all' ? '' : v })} />
  )
  const status = (
    <Dropdown label="Status" icon={Lock} ariaLabel="Filter by status" value={filters.status || 'all'}
      options={STATUS_OPTIONS.map(([value, label]) => ({ value, label }))} onChange={(v) => setFilters({ status: v === 'all' ? '' : v })} />
  )
  const sort = (
    <Dropdown label="Sort" icon={ArrowUpDown} ariaLabel="Sort outfits" value={filters.sort || 'game-asc'}
      options={SORT_OPTIONS.map(([value, label]) => ({ value, label }))} onChange={(v) => setFilters({ sort: v === 'game-asc' ? '' : v })} />
  )
  const active = [filters.game, filters.status, filters.sort].filter(Boolean).length

  return (
    <div className="wt-bar">
      <label className="wt-search">
        <Search size={20} aria-hidden="true" />
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search outfits by name or game…" aria-label="Search outfits" />
        {text && <button type="button" className="wt-clear" onClick={() => { setText(''); setFilters({ q: '' }) }} aria-label="Clear search"><X size={18} /></button>}
      </label>
      <div className="wt-drops">{game}{status}{sort}</div>
      <button type="button" className="wt-filters-btn" onClick={() => setSheet(true)} aria-label="Open filters"><SlidersHorizontal size={18} aria-hidden="true" /> Filters{active ? <span className="wt-badge">{active}</span> : null}</button>
      {sheet && (
        <div className="wt-sheet-wrap" role="dialog" aria-modal="true" aria-label="Wardrobe filters" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false) }}>
          <div className="wt-sheet">
            <div className="wt-sheet-head"><strong>Filters</strong><button type="button" onClick={() => setSheet(false)} aria-label="Close"><X size={20} /></button></div>
            <div className="wt-sheet-body">{game}{status}{sort}</div>
            <button type="button" className="wt-done" onClick={() => setSheet(false)}>Show {total} items</button>
          </div>
        </div>
      )}
    </div>
  )
}
