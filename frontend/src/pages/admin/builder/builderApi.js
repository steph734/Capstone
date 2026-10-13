import { authFetch, getSessionToken } from '../../../utils/session'

// Client for the Super Admin Game Builder API (api/_lib/routes/admin-builder*.js).
const base = '/api/admin/builder'
export const loadGame = (id) => authFetch(`${base}/games/${id}`)
export const createGame = (doc, sourceRequestId) => authFetch(`${base}/games`, { method: 'POST', body: { doc, sourceRequestId } })
export const saveGame = (id, doc, baseVersion, kind = 'autosave', allowLegacyMeta = false) => authFetch(`${base}/games/${id}`, { method: 'PUT', body: { doc, baseVersion, kind, allowLegacyMeta } })
export const publishGame = (id) => authFetch(`${base}/games/${id}/publish`, { method: 'POST', body: {} })
export const unpublishGame = (id) => authFetch(`${base}/games/${id}/unpublish`, { method: 'POST', body: {} })
export const restoreVersion = (id, version) => authFetch(`${base}/games/${id}/restore`, { method: 'POST', body: { version } })
export const markTestPlayed = (id) => authFetch(`${base}/games/${id}/test-played`, { method: 'POST', body: {} })
export const listAssets = () => authFetch(`${base}/assets`).then((b) => b.assets)

// Multipart upload (authFetch is JSON-only).
export async function uploadAsset(file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'image.png')
  const res = await fetch(`${base}/assets`, { method: 'POST', headers: { Authorization: `Bearer ${getSessionToken()}` }, body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Upload failed.'), { status: res.status, code: data.code })
  return data.asset
}

// Center-crops an image file to an aspect ratio in the browser and returns a
// new File (so the cropped version is what gets stored).
export async function cropToRatio(file, ratio) {
  const bmp = await createImageBitmap(file)
  let w = bmp.width, h = bmp.height
  if (w / h > ratio) w = Math.round(h * ratio); else h = Math.round(w / ratio)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(w, 1200); canvas.height = Math.round(canvas.width / ratio)
  canvas.getContext('2d').drawImage(bmp, (bmp.width - w) / 2, (bmp.height - h) / 2, w, h, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  return new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + '-cropped.png', { type: 'image/png' })
}
