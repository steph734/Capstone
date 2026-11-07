// Small emoji per game for the Home practice tab (the games themselves have no icon field in the data).
const ICONS = {
  'money match': '🪙', 'copy the colors': '🎨', 'sort the basket': '🧺', 'puzzle pals': '🧩', 'feed pao': '🍙', 'emergency ready': '🚑',
  'rhyme time': '🎵', 'sound hunt': '👂', 'story builder': '📖', 'sentence builder': '🧱', 'daily routines': '⏰', 'spot the difference': '🔍',
}
export const gameEmoji = (name) => ICONS[String(name || '').toLowerCase()] || '🎮'

// Dates are shown in Manila time, like the rest of the clinic.
const MANILA = { timeZone: 'Asia/Manila' }
export const shortDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...MANILA }) : '')
export const dayKeyOf = (iso) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10)
export function relativeDay(iso) {
  if (!iso) return ''
  const diff = Math.round((new Date(`${dayKeyOf(new Date())}T12:00:00Z`) - new Date(`${dayKeyOf(iso)}T12:00:00Z`)) / 86400000)
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : shortDay(iso)
}
// "Nov 15, 10:00" from a stored { date: 'YYYY-MM-DD', start: 'HH:MM' }.
export function sessionText(s) {
  if (!s?.date) return ''
  const d = new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return s.start ? `${d}, ${s.start}` : d
}
export const sessionLong = (s) => (s?.date ? `${new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}${s.start ? ` · ${s.start}` : ''}` : '')
