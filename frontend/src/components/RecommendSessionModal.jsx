import { useEffect, useRef, useState } from 'react'
import { apiPost } from '../utils/api'
import './RecommendSessionModal.css'

// Dropdown label -> the value the API / session_recommendations collection stores.
const SESSION_TYPES = [
  { value: 'Cognitive', label: 'Cognitive' },
  { value: 'Speech', label: 'Speech and Language' },
  { value: 'Occupational', label: 'Occupational Therapy' },
]
const MODES = ['In-Person', 'Online']
const DURATIONS = [30, 45, 60, 90]
const CHANNELS = [
  { id: 'chat', label: 'Chat' },
  { id: 'email', label: 'Email' },
  { id: 'in_app', label: 'In-app notification' },
]

const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

// Maps whatever the appointment's session type was onto one of the three offered.
export function defaultRecommendedType(type) {
  const t = String(type || '').toLowerCase()
  if (t.startsWith('speech')) return 'Speech'
  if (t.startsWith('occupational')) return 'Occupational'
  return 'Cognitive'
}

/**
 * "Recommend another session" — lets a therapist suggest a follow-up to the
 * parent, who then picks the date and time themselves.
 *
 * props: patient { name, guardian, lastSessionLabel }, appointmentId (the
 * completed session), defaultType, onClose(), onSent(result)
 */
export default function RecommendSessionModal({ patient, appointmentId, defaultType, onClose, onSent }) {
  const first = String(patient?.name || 'the patient').split(/\s+/)[0]
  const [sessionType, setSessionType] = useState(defaultRecommendedType(defaultType))
  const [sessionMode, setSessionMode] = useState('In-Person')
  const [duration, setDuration] = useState(60)
  const [message, setMessage] = useState(
    `${first} is doing well in therapy. It would be good to have another therapy session to keep the progress going. Please pick a date and time that works for you.`
  )
  const [via, setVia] = useState({ chat: true, email: true, in_app: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const sendVia = CHANNELS.filter((c) => via[c.id]).map((c) => c.id)
  const canSend = !busy && message.trim() && sendVia.length > 0

  const submit = async () => {
    if (!canSend) return
    setBusy(true)
    setError('')
    try {
      const data = await apiPost('/api/recommendations', {
        appointmentId, sessionType, sessionMode, durationMinutes: duration, message: message.trim(), sendVia,
      })
      onSent?.(data)
    } catch (err) {
      setError(err.message || 'Could not send the recommendation.')
      setBusy(false)
    }
  }

  return (
    <div className="rsm-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="rsm-modal" role="dialog" aria-modal="true" aria-labelledby="rsm-title">
        <div className="rsm-head">
          <div>
            <h2 id="rsm-title">Recommend another session</h2>
            <p>Let the parent know how the patient is doing. They will pick the date and time.</p>
          </div>
          <button ref={closeRef} className="rsm-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>

        <div className="rsm-body">
          <div className="rsm-patient">
            <span className="rsm-avatar">{initials(patient?.name)}</span>
            <div>
              <div className="rsm-patient-name">
                {patient?.name} {patient?.guardian && <span className="rsm-parent">· Parent: {patient.guardian}</span>}
              </div>
              {patient?.lastSessionLabel && <div className="rsm-last">Last session: {patient.lastSessionLabel}</div>}
            </div>
          </div>

          <div className="rsm-row">
            <label className="rsm-field">
              <span>Recommended session</span>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} disabled={busy}>
                {SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="rsm-field">
              <span>Mode</span>
              <select value={sessionMode} onChange={(e) => setSessionMode(e.target.value)} disabled={busy}>
                {MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="rsm-field">
              <span>Duration</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={busy}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </label>
          </div>

          <label className="rsm-field">
            <span>Message to parent</span>
            <textarea rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} disabled={busy} />
          </label>

          <fieldset className="rsm-send">
            <legend>Send through</legend>
            <div className="rsm-checks">
              {CHANNELS.map((c) => (
                <label key={c.id} className="rsm-check">
                  <input type="checkbox" checked={via[c.id]} onChange={(e) => setVia((v) => ({ ...v, [c.id]: e.target.checked }))} disabled={busy} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="rsm-error" role="alert">{error}</p>}
        </div>

        <div className="rsm-foot">
          <button className="rsm-btn rsm-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="rsm-btn rsm-btn-primary" onClick={submit} disabled={!canSend}>
            {busy ? 'Sending…' : 'Send recommendation'}
          </button>
        </div>
      </div>
    </div>
  )
}
