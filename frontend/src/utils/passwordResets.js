// The prototype's accounts live in code (TEMP_USERS in App.jsx), so a password
// changed through the "forgot password" flow can't be written back to a server.
// Instead we keep an { email: newPassword } map in localStorage; the login
// check consults it alongside the built-in passwords.
const STORAGE_KEY = 'passwordResets'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function loadPasswordResets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function savePasswordReset(email, newPassword) {
  const map = loadPasswordResets()
  map[normalizeEmail(email)] = newPassword
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Storage full or unavailable — nothing more we can do in a prototype.
  }
}

export function getResetPassword(email) {
  return loadPasswordResets()[normalizeEmail(email)] || null
}
