// Client-side range logic for the Owner Reports page. Pure functions only (no React, no fetch) so it is unit tested.
// Days are 'YYYY-MM-DD' strings in the clinic timezone (Asia/Manila). The server is the source of truth for the
// numbers and for the real comparison range; this file only drives the controls, labels and the URL.
import { manilaDateKey } from '../../../utils/manilaTime'

export const MAX_RANGE_MONTHS = 24
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const today = () => manilaDateKey()

// ── day arithmetic ───────────────────────────────────────────
export function isValidDay(s) {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
const toMs = (day) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (day, n) => fromMs(toMs(day) + n * DAY_MS)
export const diffDays = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY_MS)
export const daysInRange = (from, to) => diffDays(from, to) + 1
export function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return fromMs(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)))
}
export const monthStart = (day) => `${day.slice(0, 7)}-01`
export const monthEnd = (day) => addDays(addMonths(monthStart(day), 1), -1)

// ── formatting ───────────────────────────────────────────────
const parts = (day) => { const [y, m, d] = day.split('-').map(Number); return { y, m, d } }
export const fmtShort = (day) => { const { m, d } = parts(day); return `${MONTHS[m - 1]} ${d}` }
export const fmtLong = (day) => { const { y, m, d } = parts(day); return `${MONTHS[m - 1]} ${d}, ${y}` }
export const monthTitle = (day) => `${MONTHS_LONG[parts(day).m - 1]} ${parts(day).y}`

// "Sep 1 – Sep 30, 2026"  /  "Dec 15, 2025 – Jan 10, 2026"
export function fmtRange(from, to) {
  if (!from || !to) return ''
  if (from === to) return fmtLong(from)
  return from.slice(0, 4) === to.slice(0, 4) ? `${fmtShort(from)} – ${fmtShort(to)}, ${to.slice(0, 4)}` : `${fmtLong(from)} – ${fmtLong(to)}`
}
// Short form for "vs Aug 1 – Aug 31"
export const fmtRangeShort = (from, to) => (from && to ? (from === to ? fmtShort(from) : `${fmtShort(from)} – ${fmtShort(to)}`) : '')

// ── presets ──────────────────────────────────────────────────
export const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'last3Months', label: 'Last 3 months' },
  { key: 'thisYear', label: 'This year' },
]

export function presetRange(key, now = today()) {
  switch (key) {
    case 'today': return { from: now, to: now }
    case 'last7': return { from: addDays(now, -6), to: now }
    case 'last30': return { from: addDays(now, -29), to: now }
    case 'thisMonth': return { from: monthStart(now), to: now }
    case 'lastMonth': { const prev = addMonths(monthStart(now), -1); return { from: prev, to: monthEnd(prev) } }
    case 'last3Months': return { from: addDays(addMonths(now, -3), 1), to: now }
    case 'thisYear': return { from: `${now.slice(0, 4)}-01-01`, to: now }
    default: return null
  }
}
export const defaultRange = (now = today()) => presetRange('thisMonth', now)

// Which preset (if any) is this range? 'custom' when none match.
export function matchPreset(range, now = today()) {
  if (!range) return 'custom'
  for (const p of PRESETS) {
    const r = presetRange(p.key, now)
    if (r.from === range.from && r.to === range.to) return p.key
  }
  return 'custom'
}

// ── comparison (preview only; the server returns the real compareRange) ─────────
export function compareFor(range, mode = 'previous_period', custom) {
  if (mode === 'previous_year') return { from: addMonths(range.from, -12), to: addMonths(range.to, -12) }
  if (mode === 'custom' && custom?.from && custom?.to) return { from: custom.from, to: custom.to }
  const len = daysInRange(range.from, range.to)
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) }
}

// ── validation ───────────────────────────────────────────────
// Returns '' when fine, else a short message.
export function validateRange(from, to, now = today()) {
  if (!isValidDay(from) || !isValidDay(to)) return 'Enter real dates.'
  if (from > to) return 'The start date must not be after the end date.'
  if (from > now || to > now) return "Future dates can't be selected."
  if (to > addDays(addMonths(from, MAX_RANGE_MONTHS), -1)) return `Ranges are limited to ${MAX_RANGE_MONTHS} months.`
  return ''
}

// Accepts 2026-10-01, 10/1/2026, 10/01/2026, Oct 1, 2026, October 1 2026. Returns a day string or null.
export function parseTypedDay(text) {
  const s = String(text || '').trim()
  if (!s) return null
  if (DAY_RE.test(s)) return isValidDay(s) ? s : null
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) { const d = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; return isValidDay(d) ? d : null }
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m) {
    const idx = MONTHS.findIndex((x) => m[1].slice(0, 3).toLowerCase() === x.toLowerCase())
    if (idx < 0) return null
    const d = `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
    return isValidDay(d) ? d : null
  }
  return null
}

// ── URL <-> range ────────────────────────────────────────────
// The chosen range lives in the query string (?from=2026-10-01&to=2026-10-31), never in localStorage.
// Anything missing or invalid falls back to the default (this month so far).
export function rangeFromParams(params, now = today()) {
  const from = params.get('from')
  const to = params.get('to')
  let state = { range: defaultRange(now), compare: 'previous_period', compareCustom: null, fromUrl: false }
  if (from && to && !validateRange(from, to, now)) state = { ...state, range: { from, to }, fromUrl: true }
  else if (from && to && isValidDay(from) && isValidDay(to) && from <= to && from <= now && to > now) {
    state = { ...state, range: { from, to: now }, fromUrl: true } // future end date: clamp, like the server
  }
  const cmp = params.get('compare')
  if (cmp === 'previous_year') state.compare = cmp
  else if (cmp === 'custom') {
    const cf = params.get('compareFrom')
    const ct = params.get('compareTo')
    if (isValidDay(cf) && isValidDay(ct) && cf <= ct && ct < state.range.from) { state.compare = 'custom'; state.compareCustom = { from: cf, to: ct } }
  }
  return state
}

export function paramsForRange(range, compare = 'previous_period', compareCustom = null) {
  const p = new URLSearchParams({ from: range.from, to: range.to })
  if (compare && compare !== 'previous_period') p.set('compare', compare)
  if (compare === 'custom' && compareCustom) { p.set('compareFrom', compareCustom.from); p.set('compareTo', compareCustom.to) }
  return p
}

// API query string for the summary / exports.
export function apiQuery(range, compare = 'previous_period', compareCustom = null) {
  return paramsForRange(range, compare, compareCustom).toString()
}

// ── picker state machine ─────────────────────────────────────
// First click sets the start, the second sets the end (swapped when it is before the start). A click after that
// begins a new range. Future days are ignored.
export function pickDay(state, day, now = today()) {
  if (day > now) return state
  const { start, end } = state
  if (!start || (start && end)) return { start: day, end: null }
  return day < start ? { start: day, end: start } : { start, end: day }
}

// 6 rows x 7 columns of day strings (null for padding) for the month containing `day`; weeks start on Sunday.
export function monthGrid(day) {
  const first = monthStart(day)
  const lead = new Date(toMs(first)).getUTCDay()
  const total = Number(monthEnd(day).slice(8))
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(`${first.slice(0, 8)}${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// Keyboard: arrows move a day / week, PageUp/PageDown a month. The focus never leaves [min, today].
export function moveFocus(day, key, now = today()) {
  let next = day
  if (key === 'ArrowLeft') next = addDays(day, -1)
  else if (key === 'ArrowRight') next = addDays(day, 1)
  else if (key === 'ArrowUp') next = addDays(day, -7)
  else if (key === 'ArrowDown') next = addDays(day, 7)
  else if (key === 'PageUp') next = addMonths(day, -1)
  else if (key === 'PageDown') next = addMonths(day, 1)
  else if (key === 'Home') next = addDays(day, -new Date(toMs(day)).getUTCDay())
  else if (key === 'End') next = addDays(day, 6 - new Date(toMs(day)).getUTCDay())
  else return day
  return next > now ? now : next
}

// ── display values ───────────────────────────────────────────
export const fmtMoney = (centavos) => (centavos === null || centavos === undefined ? '—' : `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
export const fmtNumber = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-PH'))
export function fmtValue(value, format) {
  if (value === null || value === undefined) return '—'
  if (format === 'money') return fmtMoney(value)
  if (format === 'pct') return `${value}%`
  return fmtNumber(value)
}
// Latest growth shows a sign: +7.5%
export const fmtSigned = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v}%`)

// Delta line under a KPI: arrow + figure; the word "up"/"down" is for screen readers, colour comes from `tone`.
export function describeDelta(kpi, compareText) {
  const c = kpi.changePct
  if (c === null || c === undefined) return { text: '—', direction: 'flat', sr: `No comparison available ${compareText}`.trim() }
  const unit = kpi.deltaUnit === 'pts' ? ' pts' : '%'
  const direction = c > 0 ? 'up' : c < 0 ? 'down' : 'flat'
  const figure = `${Math.abs(c)}${unit}`
  const verdict = kpi.tone === 'good' ? 'improvement' : kpi.tone === 'bad' ? 'decline' : 'no change'
  return { text: figure, direction, sr: `${direction === 'flat' ? 'Unchanged' : direction === 'up' ? 'Up' : 'Down'} ${figure} ${compareText} (${verdict})` }
}

// ── stale-response guard ─────────────────────────────────────
// Every request takes a ticket; only the newest ticket may update the page, so a slow response for an old range
// can never overwrite a newer one (the AbortController is the first line of defence, this is the second).
export function createLatestGate() {
  let latest = 0
  return {
    next: () => ++latest,
    isLatest: (id) => id === latest,
  }
}
