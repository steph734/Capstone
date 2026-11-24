// System downtime: the pure rules (no imports, no I/O). Used by the API (api/_lib/downtime.js) AND by the
// Super Admin form (src/pages/admin/SystemMaintenancePage.jsx) so the plan shown while scheduling is exactly
// the plan the server will run.
export const MIN = 60 * 1000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

// Offsets before startAt. `now` is sent when the downtime is scheduled; the countdown is always on.
export const OFFSETS = { week: 7 * DAY, h24: 24 * HOUR, h1: HOUR, m15: 15 * MIN, countdown: 5 * MIN }
export const PLAN_KEYS = ['now', 'week', 'h24', 'h1', 'm15', 'countdown']
export const MIN_LEAD_MS = 15 * MIN // scheduling closer than this is rejected (use "Start now")
export const MAX_LENGTH_MS = 24 * HOUR
export const GRACE_MS = 5 * MIN // extra time for people with an upload / payment / game in progress
export const RECENT_MS = 6 * HOUR // how long "back online" / "cancelled" screens stay available

export const PLAN_LABELS = {
  now: 'Banner shown to all users',
  week: '1 week before',
  h24: '24 hours before',
  h1: '1 hour before',
  m15: '15 minutes before',
  countdown: '5-minute countdown, then sign-out',
}

export const DEFAULT_REMINDERS = { bannerNow: true, week: true, h24: true, h1: true, m15: true }
export const DEFAULT_AUDIENCE = { owners: true, therapists: true, patients: true }

const ms = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime())

// The plan for a startAt. `existing` (the previous plan) keeps anything already sent, so an edit never re-sends.
export function computePlan({ startAt, now = new Date(), reminders = DEFAULT_REMINDERS, existing = [] }) {
  const start = ms(startAt)
  const nowMs = ms(now)
  const sentBefore = new Map((existing || []).filter((p) => p.status === 'sent').map((p) => [p.key, p]))
  return PLAN_KEYS.map((key) => {
    if (sentBefore.has(key)) return { ...sentBefore.get(key) }
    if (key === 'now') return { key, sendAt: new Date(nowMs), status: 'pending', sentAt: null, skipReason: null }
    const sendAt = new Date(start - OFFSETS[key])
    const base = { key, sendAt, status: 'pending', sentAt: null, skipReason: null }
    if (key !== 'countdown' && reminders?.[key] === false) return { ...base, status: 'skipped', skipReason: 'Turned off' }
    if (sendAt.getTime() <= nowMs) return { ...base, status: 'skipped', skipReason: 'Already past when scheduled' }
    return base
  })
}

// Plain-English version for the "How TherapyPro decides" panel.
export function describeLead(startAt, now = new Date()) {
  const lead = ms(startAt) - ms(now)
  if (lead >= 7 * DAY) return '7 days or more ahead: banner now, then 1 week, 24 hours, 1 hour, 15 minutes and the 5-minute countdown.'
  if (lead >= DAY) return '1 to 7 days ahead: banner now, then 24 hours, 1 hour, 15 minutes and the 5-minute countdown.'
  if (lead >= HOUR) return '1 to 24 hours ahead: banner now, then 1 hour, 15 minutes and the 5-minute countdown.'
  return 'Under 1 hour ahead: banner now, then the 5-minute countdown.'
}

const clean = (v) => String(v ?? '').trim()

// Returns { fields: {name: message}, value } - fields is empty when valid.
export function validateSchedule(input, { now = new Date(), startNow = false, keepStartAt = null } = {}) {
  const fields = {}
  const title = clean(input.title)
  const message = clean(input.message)
  if (!title) fields.title = 'Add a title.'
  else if (title.length > 80) fields.title = 'The title can be at most 80 characters.'
  if (!message) fields.message = 'Add a message for users.'
  else if (message.length > 400) fields.message = 'The message can be at most 400 characters.'

  let releaseNotes = []
  if (input.releaseNotes != null) {
    if (!Array.isArray(input.releaseNotes)) fields.releaseNotes = 'Release notes must be a list.'
    else {
      releaseNotes = input.releaseNotes.map(clean).filter(Boolean)
      if (releaseNotes.length > 6) fields.releaseNotes = 'Add at most 6 release notes.'
      else if (releaseNotes.some((n) => n.length > 120)) fields.releaseNotes = 'Each release note can be at most 120 characters.'
    }
  }

  const startAt = new Date(input.startAt)
  const endAt = new Date(input.endAt)
  if (Number.isNaN(startAt.getTime())) fields.startAt = 'Pick a valid start date and time.'
  if (Number.isNaN(endAt.getTime())) fields.endAt = 'Pick a valid end date and time.'
  if (!fields.startAt && !startNow) {
    const unchanged = keepStartAt != null && startAt.getTime() === ms(keepStartAt)
    if (!unchanged && startAt.getTime() < ms(now) + MIN_LEAD_MS) fields.startAt = 'The start must be at least 15 minutes from now.'
  }
  if (!fields.startAt && !fields.endAt) {
    if (endAt.getTime() <= startAt.getTime()) fields.endAt = 'The end must be after the start.'
    else if (endAt.getTime() - startAt.getTime() > MAX_LENGTH_MS) fields.endAt = 'Downtime can be at most 24 hours long.'
  }

  const a = input.audience || {}
  const audience = { owners: a.owners !== false, therapists: a.therapists !== false, patients: a.patients !== false }
  if (!audience.owners && !audience.therapists && !audience.patients) fields.audience = 'Choose at least one group to notify.'
  const r = input.reminders || {}
  const reminders = { bannerNow: r.bannerNow !== false, week: r.week !== false, h24: r.h24 !== false, h1: r.h1 !== false, m15: r.m15 !== false }

  return { fields, value: { title, message, releaseNotes, startAt, endAt, audience, reminders } }
}

export const rolesFor = (audience = {}) => [
  ...(audience.owners ? ['Owner'] : []),
  ...(audience.therapists ? ['Therapist'] : []),
  ...(audience.patients ? ['Patient', 'Guardian'] : []),
]
export const roleInAudience = (role, audience) => rolesFor(audience).includes(role)
