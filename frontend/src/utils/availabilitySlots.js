// Single source of truth for the therapist's same-day slot grid. Imported by the
// picker UI (components/AvailabilityModal.jsx), the Attendance page and the
// serverless API (api/_lib/routes/therapist-availability.js) so the client and
// server can never disagree about which slots exist.
//
// `start`/`end` are 24-hour 'HH:mm' in clinic time (Asia/Manila), matching the
// `slots[].start/end` shape in the `therapist_availability` collection.
export const AVAILABILITY_SLOTS = [
  { label: '8:00 - 9:00 AM',   start: '08:00', end: '09:00', endHour: 9 },
  { label: '9:00 - 10:00 AM',  start: '09:00', end: '10:00', endHour: 10 },
  { label: '10:00 - 11:00 AM', start: '10:00', end: '11:00', endHour: 11 },
  { label: '11:00 - 12:00 PM', start: '11:00', end: '12:00', endHour: 12 },
  { label: '1:00 - 2:00 PM',   start: '13:00', end: '14:00', endHour: 14 },
  { label: '2:00 - 3:00 PM',   start: '14:00', end: '15:00', endHour: 15 },
  { label: '3:00 - 4:00 PM',   start: '15:00', end: '16:00', endHour: 16 },
  { label: '4:00 - 5:00 PM',   start: '16:00', end: '17:00', endHour: 17 },
]

export const SLOT_STARTS = AVAILABILITY_SLOTS.map((s) => s.start)

// 'HH:mm' (24h) -> '1:00 PM'
export function formatClock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// '10:00' -> '10:00 – 11:00 AM' style label used in error messages.
export function slotLabelFor(start) {
  return AVAILABILITY_SLOTS.find((s) => s.start === start)?.label.replace(' - ', ' – ') || start
}

// Group slot start times into display ranges. Slots that sit next to each other
// in the grid are one range — the grid has no 12–1 slot, and the lunch break is
// not treated as a gap — so a full day reads "8:00 AM – 5:00 PM". A slot that
// was skipped in the grid starts a new range.
// Returns [{ start, end, count, label }] in time order.
export function groupSlotRanges(starts) {
  const picked = new Set(starts)
  const ranges = []
  let current = null
  for (const slot of AVAILABILITY_SLOTS) {
    if (!picked.has(slot.start)) { current = null; continue }
    if (current) { current.end = slot.end; current.count += 1 } else {
      current = { start: slot.start, end: slot.end, count: 1 }
      ranges.push(current)
    }
  }
  return ranges.map((r) => ({ ...r, label: `${formatClock(r.start)} – ${formatClock(r.end)}` }))
}

// Hour (0-23) of "now" in the given Date as read on the clinic clock.
export function clinicHour(date = new Date(), timeZone = 'Asia/Manila') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).formatToParts(date)
  return Number(parts.find((p) => p.type === 'hour')?.value || 0)
}

export function isSlotPast(slot, now = new Date()) {
  return clinicHour(now) >= slot.endHour
}
