// Skill areas shared by the owner Activity Library and Request a Game pages.
// The Library groups games into four areas; a request can be a bit more
// specific (gross vs fine motor) and maps onto the same colours.
export const AREAS = [
  { id: 'speech', label: 'Speech & language', color: '#1FA58A', tint: '#D9F2EC' },
  { id: 'cognitive', label: 'Cognitive', color: '#7C5CE0', tint: '#E6DFFB' },
  { id: 'sel', label: 'Attention / SEL', color: '#EC4899', tint: '#FBDDEB' },
  { id: 'motor', label: 'Physical / motor', color: '#F59E0B', tint: '#FDEBC8' },
]
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]))

export function areaOf(game) {
  const t = String(game.therapyType || '').toLowerCase()
  if (t === 'speech') return 'speech'
  if (t === 'cognitive') return 'cognitive'
  if (t === 'physical' || t === 'occupational') return 'motor'
  return 'sel'
}

// Request form skills (value is what the API stores).
export const REQUEST_SKILLS = [
  { id: 'speech', label: 'Speech & language', color: '#1FA58A', tint: '#D9F2EC', area: 'speech', emoji: '🗣️' },
  { id: 'cognitive', label: 'Cognitive', color: '#7C5CE0', tint: '#E6DFFB', area: 'cognitive', emoji: '🧩' },
  { id: 'sel', label: 'Attention / SEL', color: '#EC4899', tint: '#FBDDEB', area: 'sel', emoji: '🎯' },
  { id: 'gross_motor', label: 'Gross motor', color: '#F59E0B', tint: '#FDEBC8', area: 'motor', emoji: '🤸' },
  { id: 'fine_motor', label: 'Fine motor', color: '#4A90D9', tint: '#DCEBFC', area: 'motor', emoji: '✋' },
]
export const SKILL_BY_ID = Object.fromEntries(REQUEST_SKILLS.map((s) => [s.id, s]))
