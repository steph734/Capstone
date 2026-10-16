import { useEffect, useState } from 'react'
import { authFetch, getSessionToken } from '../../../utils/session'
import { API_BASE } from '../../../utils/api'

// Client for /api/notes/:id/voice-log (see api/_lib/routes/notes-voice-log.js).
export const sendVoiceEntries = (noteId, entries) => authFetch(`/api/notes/${noteId}/voice-log`, { method: 'POST', body: { entries } })
export const fetchVoiceLog = (noteId) => authFetch(`/api/notes/${noteId}/voice-log`).then((b) => b.entries)

// { allowed, loading }. The server decides (Silver/Gold plan); a failed check keeps voice off.
export function useVoiceAccess() {
  const [state, setState] = useState({ loading: true, allowed: false })
  useEffect(() => {
    let alive = true
    authFetch('/api/notes/voice-access')
      .then((b) => alive && setState({ loading: false, allowed: Boolean(b.allowed) }))
      .catch(() => alive && setState({ loading: false, allowed: false }))
    return () => { alive = false }
  }, [])
  return state
}

// Downloads the file with the auth header (a plain link could not send it).
export async function downloadVoiceLog(noteId, { format, commands, dictation }) {
  const qs = new URLSearchParams({ format, commands: String(commands), dictation: String(dictation) })
  const res = await fetch(`${API_BASE}/api/notes/${noteId}/voice-log/export?${qs}`, { headers: { Authorization: `Bearer ${getSessionToken()}` } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not download the voice log.')
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `voice-log.${format}`
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.hidden = true
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
