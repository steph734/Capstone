// Small formatting helpers for the Appointments page. Dates are 'YYYY-MM-DD' (Manila calendar days) and times 'HH:mm'.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const at = (key) => new Date(`${key}T00:00:00Z`)
const fmt = (key, opts) => at(key).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })

export const fmt12 = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
export const timeRange = (a, b) => {
  const [h1] = String(a).split(':').map(Number); const [h2] = String(b).split(':').map(Number)
  const same = (h1 >= 12) === (h2 >= 12)
  const left = fmt12(a); return `${same ? left.replace(/ [AP]M$/, '') : left} – ${fmt12(b)}`
}
export const longDate = (key) => fmt(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
export const shortDay = (key) => fmt(key, { weekday: 'short', month: 'short', day: 'numeric' })
export const weekday3 = (key) => fmt(key, { weekday: 'short' }).toUpperCase()
export const dayNum = (key) => String(at(key).getUTCDate())
export const month3 = (key) => fmt(key, { month: 'short' })
export const monthKey = (key) => key.slice(0, 7)
export const monthTitle = (mk) => `${MONTHS[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`
export const shiftMonth = (mk, delta) => { const d = new Date(Date.UTC(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1 + delta, 1)); return d.toISOString().slice(0, 7) }
export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export const initials = (name) => { const p = String(name || '').trim().split(/\s+/).filter(Boolean); return p.length ? (p[0][0] + (p[1]?.[0] || '')).toUpperCase() : '?' }
const PALETTE = [['#e8f5f0', '#2c4a3e'], ['#e0f0ff', '#1565c0'], ['#fde8f3', '#a3175c'], ['#fef3c7', '#92400e'], ['#f3e8ff', '#7b1fa2'], ['#e0fbf5', '#0f766e']]
// A stable colour per patient (or per appointment when there is no patient id).
export const avatarColors = (id) => { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length] }

export const STATUS_TONE = { Completed: 'blue', Confirmed: 'green', Cancelled: 'red', Pending: 'amber', 'No Show': 'grey' }
