export const PROVINCES = [
  'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao', 'Aurora', 'Basilan', 'Bataan',
  'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan', 'Cagayan', 'Camarines Norte',
  'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu', 'Cotabato', 'Davao de Oro', 'Davao del Norte',
  'Davao del Sur', 'Davao Occidental', 'Davao Oriental', 'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao',
  'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte',
  'Lanao del Sur', 'Leyte', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Marinduque', 'Masbate', 'Metro Manila',
  'Misamis Occidental', 'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental',
  'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga',
  'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon',
  'South Cotabato', 'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tarlac',
  'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay',
]

export const SERVICES = ['Speech', 'Occupational', 'Physical', 'Cognitive', 'Behavioral']

export const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

export function defaultHours() {
  const out = {}
  for (const d of DAYS) out[d.key] = { open: d.key !== 'sat' && d.key !== 'sun', from: '08:00', to: '17:00' }
  return out
}

// Mirrors the server rule (api/_lib/adminBranches.js): PH mobile or landline.
export function isPhPhone(value) {
  const s = String(value || '').trim()
  if (!/^[\d\s()+-]+$/.test(s)) return false
  const digits = s.replace(/\D/g, '')
  if (digits.startsWith('63')) return digits.length >= 11 && digits.length <= 12
  if (digits.startsWith('0')) return digits.length >= 9 && digits.length <= 11
  return false
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

export const STATUS_META = {
  Active: { tone: 'green' },
  'Under review': { tone: 'amber' },
  Draft: { tone: 'gray' },
  Declined: { tone: 'red' },
  Archived: { tone: 'gray' },
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
