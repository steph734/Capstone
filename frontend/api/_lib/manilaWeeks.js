// Calendar helpers for the stats pages. The clinic works in Asia/Manila (fixed UTC+8, no daylight saving),
// so "a day" and "a week (Monday to Sunday)" are computed with a fixed offset, no timezone database needed.
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export function manilaDayKey(d) { return new Date(new Date(d).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10) }

// The Monday (as YYYY-MM-DD, Manila) of the week a moment falls in.
export function mondayWeekKey(d) {
  const manila = new Date(new Date(d).getTime() + MANILA_OFFSET_MS)
  const day = manila.getUTCDay()
  manila.setUTCDate(manila.getUTCDate() - ((day + 6) % 7))
  manila.setUTCHours(0, 0, 0, 0)
  return manila.toISOString().slice(0, 10)
}
