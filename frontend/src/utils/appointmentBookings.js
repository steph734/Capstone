// Bumped to _v2 to reset every previously stored booking — the calendar now
// starts with a clean slate and only this browser's new bookings are kept.
const STORAGE_KEY = 'therapypro_appointment_bookings_v2'

/* A date is keyed the same way the calendar keys its cells: "YYYY-M-D"
   where M is the 0-based month (0 = January). */
export function dateKey(year, month, day) {
  return `${year}-${month}-${day}`
}

/* Clinic base calendar: every day of the month starts "available". Days only
   become "booked" once they have a matching appointment (see
   buildAvailability). */
export function baseAvailability(year, month) {
  const total = new Date(year, month + 1, 0).getDate()
  const map = {}
  for (let d = 1; d <= total; d++) {
    map[dateKey(year, month, d)] = 'available'
  }
  return map
}

/* Dates this browser has booked, persisted so they survive a page reload. */
export function getBookedDates() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore malformed storage
  }
  return []
}

/* Marks a date as booked and persists it. Idempotent — booking the same day
   twice is a no-op. Once written, the day stays "booked" on every reload. */
export function markDateBooked(year, month, day) {
  const key = dateKey(year, month, day)
  const booked = getBookedDates()
  if (!booked.includes(key)) {
    booked.push(key)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(booked))
    } catch {
      // storage unavailable (private mode / quota) — nothing else to do
    }
  }
  return key
}

export function isDateBooked(year, month, day) {
  return getBookedDates().includes(dateKey(year, month, day))
}

/* Every day in the month that already has a live appointment in MongoDB,
   keyed the same way as baseAvailability ("YYYY-M-D"). */
export async function fetchBookedDates(year, month) {
  const res = await fetch(`/api/appointments/availability?year=${year}&month=${month}`)
  if (!res.ok) throw new Error('Could not load appointment availability.')
  const data = await res.json()
  return Array.isArray(data.booked) ? data.booked : []
}

/* Full availability for a month: the fixed base map with every date that has
   a MongoDB appointment (plus any booking this browser just made, so it
   shows instantly even before the server round-trip settles) forced to
   "booked". Every other day stays "available". */
export function buildAvailability(year, month, serverBooked = []) {
  const map = baseAvailability(year, month)
  for (const key of [...serverBooked, ...getBookedDates()]) {
    if (key in map) map[key] = 'booked'
  }
  return map
}
