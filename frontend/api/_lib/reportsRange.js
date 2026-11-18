// Pure date / money helpers for the Owner Reports page. No database, no I/O.
//
// Rules this file is the single source of truth for:
//  * A range "Oct 1 - Oct 31" is the half-open interval [Oct 1 00:00, Nov 1 00:00) in the CLINIC timezone
//    (CLINIC_TIMEZONE, default Asia/Manila), so the whole last day is included. Raw UTC dates are never compared.
//  * Days travel as 'YYYY-MM-DD' strings; they are only turned into instants by zonedMidnight().
//  * Comparison range ("previous_period"): the period of EQUAL LENGTH ending the day before the range starts.
//    (Oct 1-31 is compared with Aug 31-Sep 30, not Sep 1-30, because the lengths must match.)
//  * Percent change is null when the previous value is 0 (the UI shows "-"), otherwise rounded to 1 decimal.
//  * Money is handled as integer centavos; it is formatted as pesos only at display time.

export const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || 'Asia/Manila'
export const MAX_RANGE_MONTHS = 24
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86400000

export class ReportError extends Error {
  constructor(code, message, status = 422) {
    super(message)
    this.code = code
    this.status = status
  }
}

// ── day-string arithmetic (calendar only, no timezone involved) ──────────────
export function isValidDay(s) {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
const toUtc = (day) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (day, n) => fromUtc(toUtc(day) + n * DAY_MS)
export const diffDays = (a, b) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS) // b - a
export const daysInRange = (from, to) => diffDays(from, to) + 1

export function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return fromUtc(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)))
}
export const addYears = (day, n) => addMonths(day, n * 12) // Feb 29 -> Feb 28 in non-leap years

// ── clinic timezone ──────────────────────────────────────────────────────────
function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t) => Number(parts.find((p) => p.type === t).value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(utcMs / 1000) * 1000
}

// The instant at which `day` starts in the clinic timezone.
export function zonedMidnight(day, tz = CLINIC_TIMEZONE) {
  const guess = toUtc(day)
  let t = guess - tzOffsetMs(guess, tz)
  t = guess - tzOffsetMs(t, tz) // second pass settles zones whose offset changes that day
  return new Date(t)
}

export function clinicToday(now = new Date(), tz = CLINIC_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

// [start, end) instants for an inclusive day range.
export function rangeBounds(from, to, tz = CLINIC_TIMEZONE) {
  return { start: zonedMidnight(from, tz), end: zonedMidnight(addDays(to, 1), tz) }
}

// ── parsing / validation ─────────────────────────────────────────────────────
// Returns { from, to, clamped }. Throws ReportError with the documented codes.
export function parseRange(fromRaw, toRaw, { now = new Date(), tz = CLINIC_TIMEZONE } = {}) {
  if (!isValidDay(fromRaw) || !isValidDay(toRaw)) throw new ReportError('INVALID_DATE', 'Dates must be real days in YYYY-MM-DD format.')
  if (fromRaw > toRaw) throw new ReportError('RANGE_REVERSED', 'The start date must not be after the end date.')
  const today = clinicToday(now, tz)
  if (fromRaw > today) throw new ReportError('RANGE_IN_FUTURE', 'Reports cannot start in the future.')
  let to = toRaw
  let clamped = false
  if (to > today) { to = today; clamped = true } // the client is told via `clamped`
  if (to > addDays(addMonths(fromRaw, MAX_RANGE_MONTHS), -1)) {
    throw new ReportError('RANGE_TOO_LARGE', `Ranges are limited to ${MAX_RANGE_MONTHS} months.`)
  }
  return { from: fromRaw, to, clamped }
}

export function previousPeriod({ from, to }) {
  const len = daysInRange(from, to)
  return { from: addDays(from, -len), to: addDays(from, -1) }
}

export const COMPARE_MODES = ['previous_period', 'previous_year', 'custom']

export function resolveCompare(range, mode = 'previous_period', compareFrom, compareTo, opts = {}) {
  if (!COMPARE_MODES.includes(mode)) throw new ReportError('INVALID_DATE', 'Unknown comparison mode.')
  let cmp
  if (mode === 'previous_year') cmp = { from: addYears(range.from, -1), to: addYears(range.to, -1) }
  else if (mode === 'custom') {
    if (!isValidDay(compareFrom) || !isValidDay(compareTo)) throw new ReportError('INVALID_DATE', 'Comparison dates must be real days in YYYY-MM-DD format.')
    if (compareFrom > compareTo) throw new ReportError('RANGE_REVERSED', 'The comparison start must not be after its end.')
    cmp = { from: compareFrom, to: compareTo }
  } else cmp = previousPeriod(range)
  if (cmp.from <= range.to && cmp.to >= range.from) throw new ReportError('COMPARE_OVERLAPS', 'The comparison period must not overlap the selected range.')
  if (cmp.to > clinicToday(opts.now, opts.tz)) throw new ReportError('RANGE_IN_FUTURE', 'The comparison period cannot be in the future.')
  return cmp
}

// ── buckets for sparklines ───────────────────────────────────────────────────
// daily up to 31 days, weekly up to ~6 months, monthly above.
export function granularityFor(from, to) {
  const n = daysInRange(from, to)
  if (n <= 31) return 'day'
  if (n <= 186) return 'week'
  return 'month'
}

const monthIndex = (day) => { const [y, m] = day.split('-').map(Number); return y * 12 + (m - 1) }

export function bucketCount(from, to, gran = granularityFor(from, to)) {
  if (gran === 'day') return daysInRange(from, to)
  if (gran === 'week') return Math.ceil(daysInRange(from, to) / 7)
  return monthIndex(to) - monthIndex(from) + 1
}

// Index of the bucket `day` falls into, measured from `origin` (the range start). Clamped into [0, count-1].
export function bucketIndex(day, origin, gran, count) {
  let i
  if (gran === 'day') i = diffDays(origin, day)
  else if (gran === 'week') i = Math.floor(diffDays(origin, day) / 7)
  else i = monthIndex(day) - monthIndex(origin)
  return Math.max(0, Math.min(count - 1, i))
}

export function bucketLabels(from, to, gran = granularityFor(from, to)) {
  const n = bucketCount(from, to, gran)
  return Array.from({ length: n }, (_, i) => {
    if (gran === 'day') return addDays(from, i)
    if (gran === 'week') return addDays(from, i * 7)
    return addMonths(`${from.slice(0, 7)}-01`, i).slice(0, 7)
  })
}

// Sums [{ day, value }] into `count` buckets, aligned to `origin`. The same helper is used for the comparison range
// (with the current range's granularity and count) so both series always have the same number of points.
export function bucketize(rows, origin, gran, count, valueKey = 'value') {
  const out = new Array(count).fill(0)
  for (const r of rows) {
    if (r.day < origin) continue
    out[bucketIndex(r.day, origin, gran, count)] += Number(r[valueKey]) || 0
  }
  return out
}

// ── money / percent ──────────────────────────────────────────────────────────
export const toCentavos = (pesos) => Math.round((Number(pesos) || 0) * 100)

export function pctChange(current, previous) {
  if (!previous) return null // previous 0 (or missing): no meaningful percentage
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

// Colour is only for meaning. goodDirection says which way is an improvement.
export function tone(change, goodDirection) {
  if (change === null || change === 0) return 'neutral'
  const up = change > 0
  return (goodDirection === 'down' ? !up : up) ? 'good' : 'bad'
}

// ── weekdays (expected attendance days) ──────────────────────────────────────
export function countWeekdays(from, to) {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = new Date(toUtc(d)).getUTCDay()
    if (dow !== 0 && dow !== 6) n++
  }
  return n
}
