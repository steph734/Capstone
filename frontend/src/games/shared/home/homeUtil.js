import { findGame, GAME_REGISTRY } from '../gameRegistry'
import { Gamepad2 } from 'lucide-react'

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const iconFor = (name) => (GAME_REGISTRY.find((g) => norm(g.name) === norm(name)) || findGame(name))?.icon || Gamepad2
export const cardFor = (cards, name) => cards.find((c) => norm(c.title) === norm(name)) || null

export const fmt12 = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const SHORT_DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]]
export const dayRange = (days) => {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const picked = order.filter((d) => days.includes(d))
  if (picked.length === 7) return 'every day'
  const idx = picked.map((d) => order.indexOf(d))
  const run = idx.length > 2 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  const n = (d) => DAY_NAMES[d].slice(0, 3)
  return run ? `${n(picked[0])}–${n(picked[picked.length - 1])}` : picked.map(n).join(', ')
}
export const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

// The next moment home play really opens: the first practice day whose play hours are still ahead,
// never before the plan's start. Returns { day: 'Today' | 'Mon' ..., time: '4:00 PM' } or null.
export function nextOpening(plan, nowMs) {
  const OFF = 8 * 3600000
  const startMs = new Date(plan.startsAt).getTime()
  const endMs = new Date(plan.endsAt).getTime()
  const todayStart = Math.floor((nowMs + OFF) / 86400000) * 86400000 - OFF // Manila midnight today
  for (let i = 0; i < 15; i += 1) {
    const dayStart = todayStart + i * 86400000
    const wd = new Date(dayStart + OFF).getUTCDay()
    if (!plan.days.includes(wd)) continue
    const winStart = dayStart + toMin(plan.dailyStart) * 60000
    const winEnd = dayStart + toMin(plan.dailyEnd) * 60000
    const at = Math.max(winStart, startMs)
    if (at >= winEnd || at <= nowMs || at > endMs) continue
    return { day: i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAY_NAMES[wd].slice(0, 3), time: fmt12(new Date(at + OFF).toISOString().slice(11, 16)) }
  }
  return null
}

// What the home practice card should say right now. kind: none | open | done | later | closed
export function homeStatus(data, secondsLeft, nowMs) {
  if (!data?.plan) return { kind: 'none', label: '' }
  const w = data.window
  const plan = data.plan
  if (w.open && secondsLeft > 0) return { kind: 'open', label: `Open now · until ${fmt12(plan.dailyEnd)}` }
  if (w.open || w.reason === 'home_limit') return { kind: 'done', label: 'Done for today' }
  if (w.reason === 'home_hours' || w.reason === 'home_day') {
    const n = nextOpening(plan, nowMs)
    if (n) return { kind: n.day === 'today' ? 'later' : 'closed', label: `Opens ${n.day} at ${n.time}` }
  }
  if (w.reason === 'home_hours') {
    const m = new Date(nowMs + 8 * 3600000)
    const min = m.getUTCHours() * 60 + m.getUTCMinutes()
    return min < toMin(plan.dailyStart) ? { kind: 'later', label: `Opens at ${fmt12(plan.dailyStart)}` } : { kind: 'done', label: 'Done for today' }
  }
  if (w.reason === 'home_day') {
    const wd = new Date(nowMs + 8 * 3600000).getUTCDay()
    for (let i = 1; i <= 7; i += 1) { const d = (wd + i) % 7; if (plan.days.includes(d)) return { kind: 'closed', label: `Next practice day: ${DAY_NAMES[d]}` } }
  }
  if (w.reason === 'home_not_started') { const n = nextOpening(plan, nowMs); return { kind: 'later', label: n ? `Opens ${n.day} at ${n.time}` : `Opens ${shortDate(plan.startsAt)}` } }
  return { kind: 'closed', label: 'Closed right now' }
}
