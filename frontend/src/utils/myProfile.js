// The signed-in person's own profile (name, photo, ...). The server copy (GET/PUT /api/me/profile) is the real one, so
// it survives a reload, a logout and a different browser. Built-in demo accounts have no server session, so they keep
// a copy in this browser, stored per account (never one shared copy for everybody).
import { authFetch, getSessionToken } from './session'

const localKey = (email) => `myProfile:${String(email || '').trim().toLowerCase()}`

export function readLocalProfile(email) {
  try { return JSON.parse(localStorage.getItem(localKey(email))) || null } catch { return null }
}
export function writeLocalProfile(email, profile) {
  try { localStorage.setItem(localKey(email), JSON.stringify(profile)) } catch { /* storage full or blocked */ }
}

// -> the saved profile object, or null when there is none (or no way to reach it)
export async function loadMyProfile(email) {
  if (getSessionToken()) {
    try {
      const { profile } = await authFetch('/api/me/profile')
      if (profile && Object.keys(profile).length) { writeLocalProfile(email, profile); return profile }
    } catch { /* offline: fall back to this browser's copy */ }
  }
  return readLocalProfile(email)
}

// Saves to the server when there is a session (throws with the server's message if it refuses), and always keeps this
// browser's copy for the signed-in account.
export async function saveMyProfile(email, profile) {
  let saved = profile
  if (getSessionToken()) {
    const res = await authFetch('/api/me/profile', { method: 'PUT', body: profile })
    saved = { ...profile, ...(res.profile || {}) }
  }
  writeLocalProfile(email, saved)
  return saved
}

// A chosen photo, resized to about 256px and re-saved as a small JPEG so it stays well under the server's size limit.
export async function photoToAvatar(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height) // centred square crop
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  for (const q of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length <= 110000) return url
  }
  throw new Error('That photo is too large. Choose a smaller one.')
}
