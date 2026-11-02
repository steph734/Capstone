import { authFetch } from '../../../utils/session'

// Sharing a SOAP note with a covering therapist (collection note_cover_shares; guardian sharing is separate).
export const listAvailable = (date, time) => authFetch('/api/therapists/available', { query: { ...(date ? { date } : {}), ...(time ? { time } : {}) } }).then((b) => b.therapists)
export const createCoverShare = (body) => authFetch('/api/note-shares', { method: 'POST', body }).then((b) => b.share)
export const changeCoverShare = (id, body) => authFetch(`/api/note-shares/${id}`, { method: 'PATCH', body }).then((b) => b.share)
export const stopCoverShare = (id) => authFetch(`/api/note-shares/${id}`, { method: 'PATCH', body: { status: 'revoked' } })
export const acceptCoverShare = (id) => authFetch(`/api/note-shares/${id}/accept`, { method: 'POST' })
export const declineCoverShare = (id, body) => authFetch(`/api/note-shares/${id}/decline`, { method: 'POST', body })
export const handBackCoverShare = (id) => authFetch(`/api/note-shares/${id}/hand-back`, { method: 'POST' })
export const sharedWithMe = () => authFetch('/api/note-shares/shared-with-me')
export const sharedByMe = () => authFetch('/api/note-shares/by-me')
export const coverLog = (id) => authFetch(`/api/note-shares/${id}/log`).then((b) => b.log)
export const coverContext = (id, part) => authFetch(`/api/note-shares/${id}/context`, { query: { part } })

const pad = (n) => String(n).padStart(2, '0')
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—')
export const fmtDay = (key) => (key ? new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '')
export const time12 = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return `${h % 12 || 12}:${pad(m || 0)} ${h >= 12 ? 'PM' : 'AM'}` }
export const endsText = (s) => (s.endsKind === 'signed' ? 'When the note is signed' : s.endsKind === 'today' ? 'End of today' : `${fmtDay(s.endsAt ? new Date(new Date(s.endsAt).getTime() + 8 * 3600000).toISOString().slice(0, 10) : '')}`)
export const accessText = (s) => (s.access === 'view' ? 'Can view' : 'Can write & sign')
export const firstName = (n) => String(n || '').split(' ')[0]
