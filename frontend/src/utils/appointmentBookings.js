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

/* The month's bookings straight from the appointments collection: { booked, full }, each a list of "YYYY-M-D" keys.
   With a therapist, only THEIR bookings count, and "full" lists the days where they opened slots and none are left. */
export async function fetchBookedDates(year, month, employeeId = null) {
  const q = new URLSearchParams({ year: String(year), month: String(month), ...(employeeId ? { employeeId } : {}) })
  const res = await fetch(`/api/appointments/availability?${q}`)
  if (!res.ok) throw new Error('Could not load appointment availability.')
  const data = await res.json()
  return { booked: Array.isArray(data.booked) ? data.booked : [], full: Array.isArray(data.full) ? data.full : [] }
}

/* Full availability for a month: the fixed base map with every date that has a MongoDB appointment forced to "booked", and every
   date with no slot left for the chosen therapist forced to "closed" (red, cannot be picked). Every other day stays "available". */
export function buildAvailability(year, month, serverBooked = [], serverFull = []) {
  const map = baseAvailability(year, month)
  for (const key of serverBooked) {
    if (key in map) map[key] = 'booked'
  }
  for (const key of serverFull) {
    if (key in map) map[key] = 'closed'
  }
  return map
}
