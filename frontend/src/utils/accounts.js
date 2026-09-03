// The prototype's accounts live in code (no user database). These helpers work
// out the "effective" login email for each account, folding in:
//   1. credentialOverrides  — written when an email is changed on a profile page
//   2. <role>_profile        — the profile page's own saved copy (fallback)
// and let callers resolve which account a typed email belongs to.

export const TEMP_USERS = [
  { email: 'patient@gmail.com',    password: 'patient123',    name: 'Alvrin',      role: 'Patient',     avatar: '/therapy-pro-logo.png' },
  { email: 'superadmin@gmail.com', password: 'superadmin123', name: 'Super Admin', role: 'Super Admin', avatar: '/therapy-pro-logo.png' },
  { email: 'owner@gmail.com',      password: 'owner123',      name: 'Owner',       role: 'Owner',       avatar: '/therapy-pro-logo.png' },
  { email: 'therapists@gmail.com', password: 'therapist123',  name: 'Therapist',   role: 'Therapist',   avatar: '/therapy-pro-logo.png' },
]

export const CREDENTIAL_OVERRIDES_KEY = 'credentialOverrides'

const PROFILE_STORAGE_BY_ROLE = {
  Patient: 'patient_profile',
  'Super Admin': 'admin_profile',
  Owner: 'owner_profile',
  Therapist: 'therapist_profile',
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export function loadCredentialOverrides() {
  try {
    return JSON.parse(localStorage.getItem(CREDENTIAL_OVERRIDES_KEY)) || {}
  } catch {
    return {}
  }
}

export function setCredentialOverride(role, patch) {
  if (!role) return
  const all = loadCredentialOverrides()
  all[role] = { ...all[role], ...patch }
  try {
    localStorage.setItem(CREDENTIAL_OVERRIDES_KEY, JSON.stringify(all))
  } catch {
    // Storage full or unavailable — nothing more we can do in a prototype.
  }
}

function readProfileEmail(storageKey) {
  if (!storageKey) return null
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    const email = saved && typeof saved.email === 'string' ? saved.email.trim() : ''
    return email || null
  } catch {
    return null
  }
}

export function getEffectiveUsers() {
  const overrides = loadCredentialOverrides()
  return TEMP_USERS.map((user) => {
    const email =
      overrides[user.role]?.email ||
      readProfileEmail(PROFILE_STORAGE_BY_ROLE[user.role]) ||
      user.email
    return { ...user, email }
  })
}

// Which account does this email currently belong to? Checks the effective email
// (after any profile change) first, then the built-in email.
export function resolveAccountByEmail(email) {
  const target = normalizeEmail(email)
  if (!target) return null
  const effective = getEffectiveUsers()
  return (
    effective.find((user) => normalizeEmail(user.email) === target) ||
    effective.find((user) => {
      const builtIn = TEMP_USERS.find((t) => t.role === user.role)
      return builtIn && normalizeEmail(builtIn.email) === target
    }) ||
    null
  )
}
