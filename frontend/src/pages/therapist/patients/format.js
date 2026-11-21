// Display helpers and the form rules (the server applies the same rules again).
const PALETTES = [['#fff1c9', '#8a5a00'], ['#e6defb', '#4b2f9e'], ['#dfe8ff', '#2f4ba0'], ['#d9f2e3', '#1c6b44'], ['#fde3e8', '#9a2b45'], ['#e0f2f7', '#1f6377']]

export function palette(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTES[h % PALETTES.length]
}
export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

// Session dates are calendar dates stored at UTC midnight; joined/created use the clinic's zone.
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : null)
export const fmtJoined = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : null)
export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function normalizePhone(raw) {
  let d = String(raw || '').replace(/[\s()-]/g, '')
  if (d.startsWith('+63')) d = `0${d.slice(3)}`
  else if (d.startsWith('63') && d.length === 12) d = `0${d.slice(2)}`
  return /^09\d{9}$/.test(d) ? d : null
}
export const prettyPhone = (p) => (p && p.length === 11 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p || '')

export const GENDERS = ['Male', 'Female', 'Other']
export const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Other']
export const CONDITIONS = ['Speech Delay', 'ADHD', 'Autism Spectrum Disorder', 'Down Syndrome', 'Cerebral Palsy', 'Developmental Delay', 'Learning Disability', 'Other']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EMPTY_FORM = {
  photo: '', firstName: '', lastName: '', nickname: '', gender: '', birthdate: '', address: '', conditionPick: '', conditionOther: '',
  gFirst: '', gLast: '', relationship: '', contact: '', email: '', sendInvite: true,
}
export const conditionOf = (f) => (f.conditionPick === 'Other' ? f.conditionOther.trim() : f.conditionPick)

const todayIso = () => new Date().toISOString().slice(0, 10)
export function ageOn(iso) {
  const b = new Date(`${iso}T00:00:00Z`); const n = new Date()
  let a = n.getUTCFullYear() - b.getUTCFullYear()
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a -= 1
  return a
}

// 11 required fields, errors by key.
export function validateForm(f) {
  const e = {}
  if (!f.firstName.trim()) e.firstName = 'First name is required.'
  if (!f.lastName.trim()) e.lastName = 'Last name is required.'
  if (!GENDERS.includes(f.gender)) e.gender = 'Choose a gender.'
  if (!f.birthdate) e.birthdate = 'Birthdate is required.'
  else if (f.birthdate > todayIso()) e.birthdate = 'Birthdate cannot be in the future.'
  else if (ageOn(f.birthdate) > 18) e.birthdate = 'Patients must be 18 or younger.'
  if (!f.address.trim()) e.address = 'Address is required.'
  if (!conditionOf(f)) e.condition = f.conditionPick === 'Other' ? 'Describe the condition.' : 'Choose a condition.'
  if (!f.gFirst.trim()) e.gFirst = 'First name is required.'
  if (!f.gLast.trim()) e.gLast = 'Last name is required.'
  if (!RELATIONSHIPS.includes(f.relationship)) e.relationship = 'Choose a relationship.'
  if (!normalizePhone(f.contact)) e.contact = 'Enter a PH mobile number like 09XX XXX XXXX.'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.'
  return e
}
export const REQUIRED_KEYS = ['firstName', 'lastName', 'gender', 'birthdate', 'address', 'condition', 'gFirst', 'gLast', 'relationship', 'contact', 'email']
export const completeCount = (f) => { const e = validateForm(f); return REQUIRED_KEYS.filter((k) => !e[k]).length }
export const isDirty = (f) => JSON.stringify({ ...f, sendInvite: true }) !== JSON.stringify({ ...EMPTY_FORM })

// Reference numbers: GCash 13 digits, Maya 10-16 (same as the booking checkout).
export const REF_RULES = { gcash: { label: 'GCash', min: 13, max: 13, groups: [4, 3, 3, 3] }, paymaya: { label: 'Maya', min: 10, max: 16, groups: [4, 4, 4, 4] } }
export const digitsOf = (s) => String(s || '').replace(/\D/g, '')
export function formatRef(raw, method) {
  const d = digitsOf(raw); const out = []; let i = 0
  for (const g of REF_RULES[method].groups) { if (i >= d.length) break; out.push(d.slice(i, i + g)); i += g }
  if (i < d.length) out.push(d.slice(i))
  return out.join(' ')
}
export function refError(raw, method) {
  const r = REF_RULES[method]; const n = digitsOf(raw).length
  if (!n) return 'Reference number is required.'
  if (n < r.min || n > r.max) return method === 'gcash' ? 'GCash reference numbers have 13 digits.' : 'Maya reference numbers have 10 to 16 digits.'
  return ''
}

// Child's photo: center-crop to a square and shrink, entirely in the browser.
export async function processPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a JPG, PNG or WEBP photo.')
  if (file.size > 5 * 1024 * 1024) throw new Error('That photo is larger than 5 MB. Choose a smaller one.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This device could not read that photo.')); i.src = url })
    const side = Math.min(img.width, img.height); const c = document.createElement('canvas'); c.width = 512; c.height = 512
    c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512)
    return c.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}
export const readAsDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read that file.')); r.readAsDataURL(file) })
export const newKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 8)}`)
