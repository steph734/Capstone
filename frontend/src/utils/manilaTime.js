// The clinic operates only in the Philippines (no DST), so every attendance
// timestamp should read the same way regardless of which timezone the
// viewing device happens to be set to — mirrors CLINIC_TIMEZONE in
// backend/routes/attendance.js.
export const CLINIC_TIMEZONE = 'Asia/Manila'

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// YYYY-MM-DD calendar day in Philippine local time — matches the backend's
// dateKeyOf()/todayStamp() and the attendance_date field stored on each scan.
export function manilaDateKey(d = new Date()) {
  return dayKeyFormatter.format(new Date(d))
}

export function formatManilaTime(iso, opts) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: CLINIC_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    ...opts,
  })
}

// Accepts either an ISO instant or a 'YYYY-MM-DD' calendar-day string — the
// latter is parsed as local noon so formatting it can never shift it to the
// previous/next day.
export function formatManilaDate(input, opts) {
  if (!input) return ''
  const d = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? new Date(`${input}T12:00:00Z`)
    : new Date(input)
  return d.toLocaleDateString('en-US', {
    timeZone: CLINIC_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  })
}

// Minutes since Philippine local midnight — for "is this after the cutoff"
// checks (e.g. late arrival) that must stay correct regardless of viewer
// timezone.
export function manilaMinutesOfDay(iso) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  return hour * 60 + minute
}
