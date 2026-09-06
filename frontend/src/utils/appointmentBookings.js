// Bumped to _v2 to reset every previously stored booking — the calendar now
// starts with a clean slate and only this browser's new bookings are kept.
const STORAGE_KEY = 'therapypro_appointment_bookings_v2'

/* A date is keyed the same way the calendar keys its cells: "YYYY-M-D"
   where M is the 0-based month (0 = January). */
export function dateKey(year, month, day) {
  return `${year}-${month}-${day}`
}

/* Clinic base calendar: every day of the month starts "available". Days only
   become "booked" once this browser confirms a booking on them (see
   getAvailability). */
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

/* Full availability for a month: the fixed base map with every booked date
   (this browser's confirmed bookings) forced to "booked". */
export function getAvailability(year, month) {
  const map = baseAvailability(year, month)
  for (const key of getBookedDates()) {
    if (key in map) map[key] = 'booked'
  }
  return map
}
