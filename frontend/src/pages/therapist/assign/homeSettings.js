// Home practice settings: defaults, summary text and the request body. All times are Asia/Manila.
export const DAY_CHIPS = [['M', 1, 'Mon'], ['T', 2, 'Tue'], ['W', 3, 'Wed'], ['T', 4, 'Thu'], ['F', 5, 'Fri'], ['S', 6, 'Sat'], ['S', 0, 'Sun']]
export const LIMITS = [10, 15, 20, 30]
const pad = (n) => String(n).padStart(2, '0')

export const manilaInstant = (day, hhmm) => new Date(`${day}T${hhmm}:00+08:00`)
export const manilaDayOf = (iso) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10)
export const manilaHHMM = (iso) => { const d = new Date(new Date(iso).getTime() + 8 * 3600000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
const addDays = (day, n) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
export const fmt12 = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return `${h % 12 || 12}:${pad(m || 0)} ${h >= 12 ? 'PM' : 'AM'}` }
export const longDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

// First defaults: open right after the session, until the next appointment (or a week), Mon-Fri 4-7 PM, 15 min, 3x a week.
export function defaultHome(today, nextSession) {
  return {
    opens: 'after', customStart: `${today}T16:00`, until: nextSession?.date || addDays(today, 7),
    days: [1, 2, 3, 4, 5], dailyStart: '16:00', dailyEnd: '19:00', limit: 15, goal: 3, notify: true, save: true, autoLevel: false,
  }
}

// Home settings back from a saved plan.
export function homeFromPlan(p) {
  return {
    opens: 'custom', customStart: `${manilaDayOf(p.startsAt)}T${manilaHHMM(p.startsAt)}`, until: manilaDayOf(p.endsAt),
    days: p.days, dailyStart: p.dailyStart, dailyEnd: p.dailyEnd, limit: p.dailyLimitMinutes, goal: p.goalPerGamePerWeek,
    notify: p.notifyCaregiver, save: p.saveToProgress, autoLevel: p.autoLevelUp,
  }
}

export const daysText = (days) => {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const names = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun' }
  const picked = order.filter((d) => days.includes(d))
  if (picked.length === 7) return 'Every day'
  const idx = picked.map((d) => order.indexOf(d))
  const consecutive = idx.length > 2 && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  return consecutive ? `${names[picked[0]]} – ${names[picked[picked.length - 1]]}` : picked.map((d) => names[d]).join(', ')
}

export const homeSummary = (h) => `${daysText(h.days)} · ${fmt12(h.dailyStart).replace(':00', '')}–${fmt12(h.dailyEnd).replace(':00', '')} · ${h.limit} min a day · until ${longDay(h.until)}`

// The request body for POST/PATCH /api/home-practice-plans. `sessionEnd` = 'HH:MM' of the session end today.
export function homeBody(h, { patientId, day, sessionEnd, sessionPlanId, appointmentId, games }) {
  const startsAt = h.opens === 'after' ? manilaInstant(day, sessionEnd || '12:00') : new Date(`${h.customStart}:00+08:00`)
  return {
    patientId, sessionPlanId: sessionPlanId || undefined, appointmentId: appointmentId || undefined, games,
    startsAt: startsAt.toISOString(), endsAt: manilaInstant(h.until, '23:59').toISOString(), days: h.days,
    dailyStart: h.dailyStart, dailyEnd: h.dailyEnd, dailyLimitMinutes: h.limit, goalPerGamePerWeek: h.goal,
    notifyCaregiver: h.notify, saveToProgress: h.save, autoLevelUp: h.autoLevel,
  }
}
