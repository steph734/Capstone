// Time helpers for System Downtime. Dates are stored in UTC; people always see Philippine time (Asia/Manila, UTC+8, no DST).
export const TZ = 'Asia/Manila'
const OPT = { timeZone: TZ }

export const fmtDate = (d, o = {}) => new Date(d).toLocaleDateString('en-US', { ...OPT, weekday: 'short', month: 'short', day: 'numeric', ...o })
export const fmtDateLong = (d) => fmtDate(d, { year: 'numeric' })
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { ...OPT, hour: 'numeric', minute: '2-digit', hour12: true })
export const fmtRange = (a, b) => `${fmtTime(a)} - ${fmtTime(b)}`.replace(' - ', ' – ')

// "2026-11-26" + "22:00" (Manila wall clock) -> Date
export const fromManila = (date, time) => new Date(`${date}T${time}:00+08:00`)
// Date -> { date: "YYYY-MM-DD", time: "HH:mm" } in Manila
export function toManilaParts(d) {
  const s = new Date(new Date(d).getTime() + 8 * 3600 * 1000).toISOString()
  return { date: s.slice(0, 10), time: s.slice(11, 16) }
}

// 7200000 -> "2 hours", 2700000 -> "45 min", 5400000 -> "1 h 30 min"
export function durationText(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60), r = m % 60
  if (!h) return `${r} min`
  if (!r) return h === 1 ? '1 hour' : `${h} hours`
  return `${h} h ${r} min`
}
// "About 2 hours"
export const aboutText = (ms) => `About ${durationText(ms)}`

// ms until -> { days, hours, minutes } (rounded down; used by the "DAYS HOURS MINUTES" tiles)
export function countdownParts(ms) {
  const t = Math.max(0, Math.floor(ms / 60000))
  return { days: Math.floor(t / 1440), hours: Math.floor((t % 1440) / 60), minutes: t % 60 }
}
// "6 days 2 h", "3 h 10 min", "12 min"
export function untilText(ms) {
  const { days, hours, minutes } = countdownParts(ms)
  if (days) return `${days} ${days === 1 ? 'day' : 'days'}${hours ? ` ${hours} h` : ''}`
  if (hours) return `${hours} h${minutes ? ` ${minutes} min` : ''}`
  return `${Math.max(1, minutes)} min`
}
export const pad2 = (n) => String(n).padStart(2, '0')
