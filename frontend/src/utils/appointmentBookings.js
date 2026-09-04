const STORAGE_KEY = 'therapypro_appointment_bookings'

/* A date is keyed the same way the calendar keys its cells: "YYYY-M-D"
   where M is the 0-based month (0 = January). */
export function dateKey(year, month, day) {
  return `${year}-${month}-${day}`
}

/* Deterministic 0..1 value derived from the date key (FNV-1a hash).
   Unlike Math.random(), this returns the SAME status for a given day on
   every reload, so the clinic's base calendar never reshuffles. */
function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/* Fixed clinic availability for a month — same thresholds as the old mock,
   but stable per date instead of random. Some days come back "booked" to
   represent slots other patients have already taken. */
export function baseAvailability(year, month) {
  const total = new Date(year, month + 1, 0).getDate()
  const map = {}
  for (let d = 1; d <= total; d++) {
    const key = dateKey(year, month, d)
    const r = hash01(key)
    if (r < 0.35) map[key] = 'booked'
    else if (r < 0.55) map[key] = 'closed'
    else map[key] = 'available'
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
