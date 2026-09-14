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

/* Every day in the month that already has a live appointment in MongoDB,
   keyed the same way as baseAvailability ("YYYY-M-D"). */
export async function fetchBookedDates(year, month) {
  const res = await fetch(`/api/appointments/availability?year=${year}&month=${month}`)
  if (!res.ok) throw new Error('Could not load appointment availability.')
  const data = await res.json()
  return Array.isArray(data.booked) ? data.booked : []
}

/* Full availability for a month: the fixed base map with every date that has
   a MongoDB appointment forced to "booked". Every other day stays
   "available" — MongoDB's appointments collection is the only source of
   truth, so this never drifts out of sync with what's actually booked. */
export function buildAvailability(year, month, serverBooked = []) {
  const map = baseAvailability(year, month)
  for (const key of serverBooked) {
    if (key in map) map[key] = 'booked'
  }
  return map
}
