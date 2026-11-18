// Client for the Owner finance API + money helpers. Money is integer centavos everywhere on the wire.
import { API_BASE } from '../../../utils/api'
import { getSessionToken } from '../../../utils/session'

const auth = () => ({ Authorization: `Bearer ${getSessionToken()}` })

async function parse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = data.code
    err.fields = data.fields || null
    throw err
  }
  return data
}

export async function call(path, { method = 'GET', body, query, headers, signal } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))}` : ''
  const res = await fetch(`${API_BASE}/api/owner/${path}${qs}`, {
    method, signal,
    headers: { ...auth(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return parse(res)
}

export async function upload(path, file) {
  const fd = new FormData()
  fd.append('file', file)
  return parse(await fetch(`${API_BASE}/api/owner/${path}`, { method: 'POST', headers: auth(), body: fd }))
}

// Authenticated file download / preview (files are never public URLs).
export async function fetchBlob(path) {
  const res = await fetch(`${API_BASE}/api/owner/${path}`, { headers: auth() })
  if (!res.ok) throw new Error('Could not open the file.')
  const blob = await res.blob()
  const name = ((res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] || 'file'
  return { blob, name }
}
export async function openBlob(path, { download = false } = {}) {
  const { blob, name } = await fetchBlob(path)
  const url = URL.createObjectURL(blob)
  if (download) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove() } else window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`)

// ── money ────────────────────────────────────────────────────
export const roundHalfAway = (x) => Math.sign(x) * Math.round(Math.round(Math.abs(x) * 1e6) / 1e6)
export const lineAmount = (qty, unit) => roundHalfAway(Number(qty) * Number(unit))
// "1,234.50" -> 123450 ; '' -> null ; invalid -> NaN
export function parsePesos(text) {
  const s = String(text ?? '').replace(/[₱,\s]/g, '')
  if (s === '') return null
  if (!/^\d+(\.\d{0,4})?$/.test(s)) return NaN
  return roundHalfAway(parseFloat(s) * 100)
}
export const pesosText = (c) => (c === null || c === undefined || Number.isNaN(c) ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''))
export const peso = (c, { decimals = false } = {}) => (c === null || c === undefined ? '—' : `₱${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 })}`)
export const peso2 = (c) => peso(c, { decimals: true })

// ── dates ('YYYY-MM-DD' in Manila) ───────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDay = (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}` }
export const fmtShortDay = (d) => { if (!d) return '—'; const [, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}` }
export const fmtPeriod = (a, b) => (a && b ? `${fmtShortDay(a)} – ${fmtShortDay(b)}` : fmtDay(a || b))
export function dueText(days, paid) {
  if (paid || days === null || days === undefined) return ''
  if (days === 0) return 'due today'
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} overdue`
}
export const errMsg = (e) => (e?.fields ? 'Please fix the highlighted fields.' : e?.message || 'Something went wrong.')
