import { useEffect, useRef, useState } from 'react'
import { authFetch } from '../../../../utils/session'

// SOAP note about a patient's home practice. It is saved as a normal draft note (encrypted, versioned and audited like every note),
// the Objective starts with what was recorded at home, and the set remembers the note. Only then can the next set be chosen.
// The therapist signs the draft later in Notes & Progress.
const MIN = 10 // same minimum the notes page asks for before signing
const SECTIONS = [
  ['subjective', 'S · Subjective', 'What the patient or family said about practicing at home.'],
  ['objective', 'O · Objective', 'What was recorded at home. Add what you observed.'],
  ['assessment', 'A · Assessment', 'How the home practice went, in your clinical words.'],
  ['plan', 'P · Plan', 'What comes next, for example the next set of games.'],
]

export default function HomeSoapModal({ patient, onClose, onSaved }) {
  const [v, setV] = useState({ subjective: '', objective: '', assessment: '', plan: '' })
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    let alive = true
    authFetch('/api/therapist/home-sets/summary', { query: { setId: patient.setId } })
      .then((d) => { if (alive) setV((x) => ({ ...x, objective: d.text })) })
      .catch((e) => { if (alive) setError(e.message || 'Could not load the home practice summary.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [patient.setId])

  useEffect(() => {
    const back = document.activeElement
    box.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll('button:not([disabled]),textarea,[href]')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const a = f[0], z = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === a || document.activeElement === box.current)) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); back?.focus?.() }
  }, [onClose])

  const submit = async () => {
    const bad = Object.fromEntries(SECTIONS.filter(([k]) => v[k].trim().length < MIN).map(([k]) => [k, `Write at least ${MIN} characters.`]))
    setErrors(bad)
    if (Object.keys(bad).length) return
    setBusy(true); setError('')
    try {
      const note = await authFetch('/api/notes/create', { method: 'POST', body: { patientId: patient.patientId, ...v } })
      await authFetch('/api/therapist/home-sets/soap', { method: 'POST', body: { setId: patient.setId, noteId: note.id } })
      onSaved(note)
    } catch (e) { setError(e.message || 'Could not save the SOAP note.'); setBusy(false) }
  }

  return (
    <div className="hs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="hs-modal hs-soap-modal" role="dialog" aria-modal="true" aria-labelledby="hs-soap-title" tabIndex={-1} ref={box}>
        <header className="hs-modal-head">
          <div>
            <h2 id="hs-soap-title">SOAP note · home practice</h2>
            <p>{patient.name} finished set {patient.setNumber} at home. Document how it went before choosing the next set. It is saved as a draft you can sign in Notes &amp; Progress.</p>
          </div>
          <button type="button" className="hs-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="hs-soap">
          {SECTIONS.map(([k, label, hint]) => (
            <label key={k}>
              <span>{label} <small>{hint}</small></span>
              <textarea value={v[k]} disabled={loading && k === 'objective'} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} aria-invalid={Boolean(errors[k])} maxLength={5000} />
              {errors[k] && <span className="hs-fielderr" role="alert">{errors[k]}</span>}
            </label>
          ))}
        </div>
        <footer className="hs-modal-foot">
          <p>{error ? <span className="hs-err-text" role="alert">{error}</span> : 'Only the plays recorded at home are filled in for you. Check and edit everything before saving.'}</p>
          <button type="button" className="hs-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="hs-btn green" disabled={busy || loading} onClick={submit}>{busy ? 'Saving…' : 'Save SOAP note'}</button>
        </footer>
      </div>
    </div>
  )
}
