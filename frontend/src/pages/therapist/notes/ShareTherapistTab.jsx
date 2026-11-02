import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { changeCoverShare, createCoverShare, firstName, listAvailable, time12 } from './coverApi'
import './cover.css'

// Tab switcher shared by both halves of the modal.
export function ShareTabs({ tab, onTab }) {
  return (
    <div className="cv-tabs" role="tablist" aria-label="Share with">
      <button type="button" role="tab" aria-selected={tab === 'guardian'} className={tab === 'guardian' ? 'on' : ''} onClick={() => onTab('guardian')}>Guardian</button>
      <button type="button" role="tab" aria-selected={tab === 'therapist'} className={tab === 'therapist' ? 'on' : ''} onClick={() => onTab('therapist')}>Another therapist</button>
    </div>
  )
}

const AVAIL = { free: ['Free at', 'free'], busy: ['Busy at', 'busy'], unavailable: ['Unavailable', 'off'] }

// "Another therapist" tab. `patient` = { id, name }, `session` = { id, date, start, end, noteId, noteStatus },
// `existing` = an active share when the owner is changing the therapist.
export default function ShareTherapistModal({ patient, session, existing, tabs, onDone, onClose }) {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const [access, setAccess] = useState(existing?.access || (session?.noteStatus === 'signed' ? 'view' : 'write_sign'))
  const [endsKind, setEndsKind] = useState(existing?.endsKind || 'signed')
  const [customDate, setCustomDate] = useState('')
  const [past, setPast] = useState(existing ? existing.includePastNotes : true)
  const [goals, setGoals] = useState(existing ? existing.includeGoals : true)
  const [games, setGames] = useState(existing ? existing.includeGameProgress : true)
  const [message, setMessage] = useState(existing?.message || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const signed = session?.noteStatus === 'signed'
  // Pending or accepted: change the therapist. Declined, stopped or expired: a new share with the same options.
  const changing = Boolean(existing) && ['pending', 'accepted'].includes(existing.status)

  useEffect(() => {
    let alive = true
    listAvailable(session?.date, session?.start).then((l) => { if (alive) setList(l) }).catch((e) => { if (alive) { setList([]); setError(e.message) } })
    return () => { alive = false }
  }, [session?.date, session?.start])
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  const shown = useMemo(() => (list || []).filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())), [list, q])
  const chosen = (list || []).find((t) => t.id === pick)
  const first = chosen ? firstName(chosen.name) : 'therapist'
  const timeLabel = session?.start ? session.start : ''

  const submit = async () => {
    if (!chosen || busy) return
    setBusy(true); setError('')
    try {
      const common = { endsKind, customDate, includePastNotes: past, includeGoals: goals, includeGameProgress: games, message }
      const share = changing
        ? await changeCoverShare(existing.id, { coverId: chosen.id, ...common })
        : await createCoverShare({ patientId: patient.id, appointmentId: session?.id, noteId: session?.noteId || undefined, coverId: chosen.id, access: signed ? 'view' : access, ...common })
      onDone(share, chosen)
    } catch (e) { setError(e.message || 'Could not share this note.'); setBusy(false) }
  }

  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal" role="dialog" aria-modal="true" aria-labelledby="cv-title" onClick={(e) => e.stopPropagation()}>
        {tabs}
        <h3 id="cv-title">{changing ? 'Change therapist' : existing ? 'Share with another therapist' : 'Share SOAP note with a therapist'}</h3>
        <p className="cv-help">Can&apos;t attend today? Let another therapist write and sign {patient.name}&apos;s note. They only see what you allow, and every view is logged.</p>

        <h4 className="cv-label">Note to share</h4>
        <div className="cv-row on" aria-live="polite">
          <span className="cv-radio on" />
          <b>{session?.noteStatus === 'draft' ? 'Unsigned draft' : signed ? 'Signed session note' : "Today's session note"}</b>
          <span className="cv-muted">{session?.dateLabel}{timeLabel ? ` · ${time12(timeLabel)}` : ''} · {session?.noteStatus === 'draft' ? 'draft' : signed ? 'signed' : 'not started'}</span>
        </div>
        {signed && <p className="cv-hint">Signed notes can only be shared as &quot;Can view&quot;.</p>}

        <h4 className="cv-label">Therapist</h4>
        <label className="cv-search"><Search size={16} aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search active therapists…" aria-label="Search therapists" /></label>
        <div className="cv-list" role="radiogroup" aria-label="Therapist">
          {list === null && <p className="cv-muted">Loading therapists…</p>}
          {list && shown.length === 0 && <p className="cv-muted">No therapists found.</p>}
          {shown.map((t) => {
            const off = t.availability === 'unavailable'
            const [word, cls] = AVAIL[t.availability]
            return (
              <button key={t.id} type="button" role="radio" aria-checked={pick === t.id} disabled={off} className={`cv-row${pick === t.id ? ' on' : ''}${off ? ' off' : ''}`} onClick={() => setPick(t.id)}>
                <span className={`cv-radio${pick === t.id ? ' on' : ''}`} />
                <span className="cv-avatar">{t.initials}{t.online && <i aria-label="Active now" />}</span>
                <span className="cv-who"><b>{t.name}</b><small>{off ? t.reason : `${t.specialty} · ${t.online ? 'Active now' : 'Not clocked in'}`}</small></span>
                <span className={`cv-chip ${cls}`}>{off ? word : `${word} ${session?.start || ''}`}</span>
              </button>
            )
          })}
        </div>

        <div className="cv-two">
          <div>
            <h4 className="cv-label">Access</h4>
            <div className="cv-seg" role="radiogroup" aria-label="Access">
              <button type="button" role="radio" aria-checked={access === 'view' || signed} className={access === 'view' || signed ? 'on' : ''} onClick={() => setAccess('view')}>Can view</button>
              <button type="button" role="radio" aria-checked={access === 'write_sign' && !signed} disabled={signed} className={access === 'write_sign' && !signed ? 'on dark' : ''} onClick={() => setAccess('write_sign')}>Can write &amp; sign</button>
            </div>
          </div>
          <div>
            <h4 className="cv-label">Access ends</h4>
            <select className="cv-select" value={endsKind} onChange={(e) => setEndsKind(e.target.value)} aria-label="Access ends">
              <option value="signed">When the note is signed</option>
              <option value="today">End of today</option>
              <option value="custom">Custom date</option>
            </select>
            {endsKind === 'custom' && <input className="cv-select" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} aria-label="Custom end date" style={{ marginTop: 8 }} />}
          </div>
        </div>

        <h4 className="cv-label">Also let them see</h4>
        <div className="cv-checks">
          {[['Past signed notes', past, setPast], ['Goals & diagnosis', goals, setGoals], ['Game progress', games, setGames]].map(([label, on, set]) => (
            <label key={label} className={on ? 'on' : ''}><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> {label}</label>
          ))}
        </div>

        <h4 className="cv-label">Message to {first} <span className="cv-muted">(optional)</span></h4>
        <textarea className="cv-text" rows={3} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Focus on matching tasks; she does best with visual prompts." />

        {error && <p className="cv-error" role="alert">{error}</p>}
        <div className="cv-actions">
          <button type="button" className="cv-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="cv-btn primary" disabled={!chosen || busy || (endsKind === 'custom' && !customDate)} onClick={submit}>{busy ? 'Sharing…' : chosen ? `Share with ${first}` : 'Pick a therapist'}</button>
        </div>
      </div>
    </div>
  )
}
