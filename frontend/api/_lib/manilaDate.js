// The date a session note belongs to is decided by the server, never by the browser.
// The clinic works in Philippine time (Asia/Manila), so "today" is that day's calendar date.
export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) // YYYY-MM-DD
}

// Notes written offline are sent later, so for those ONLY the device's date is accepted, and only if it is
// a real date, not in the future, and at most 7 days old. Anything else falls back to the server's today.
export function boundedOfflineDate(claimed, now = new Date()) {
  const today = manilaToday(now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(claimed || ''))) return { date: today, fromDevice: false }
  const t = Date.parse(claimed + 'T00:00:00Z')
  const days = (Date.parse(today + 'T00:00:00Z') - t) / 86400000
  if (Number.isNaN(t) || days < 0 || days > 7) return { date: today, fromDevice: false }
  return { date: claimed, fromDevice: true }
}
