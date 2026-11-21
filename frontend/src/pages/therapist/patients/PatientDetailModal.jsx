import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Mail, Copy, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'
import { Dialog, Avatar, StatusBadge } from './ui'
import { patientsApi } from './api'
import { fmtDay, fmtJoined, prettyPhone } from './format'

function Field({ label, value, onCopy }) {
  if (!value) return null // a missing value hides the row instead of showing "undefined"
  return (
    <div className="pm-field-row">
      <span className="pm-field-label">{label}</span>
      <span className="pm-field-value">{value}</span>
      {onCopy && <button type="button" className="pm-copy" onClick={() => onCopy(value, label)} aria-label={`Copy ${label}`}><Copy size={14} aria-hidden="true" /> Copy</button>}
    </div>
  )
}

export default function PatientDetailModal({ id, summary, onClose, onBook, onMessage, flash }) {
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, patient: null, error: '', gone: false })
  const [inviteBusy, setInviteBusy] = useState(false)

  useEffect(() => {
    let live = true
    patientsApi.get(id)
      .then((d) => live && setState({ loading: false, patient: d.patient, error: '', gone: false }))
      .catch((e) => live && setState({ loading: false, patient: null, error: e.message, gone: e.status === 404 }))
    return () => { live = false }
  }, [id])

  const p = state.patient
  const copy = async (value, label) => {
    try { await navigator.clipboard.writeText(String(value)); flash(`${label} copied`) } catch { flash('Could not copy. Select the text and copy it.') }
  }
  const resend = async () => {
    setInviteBusy(true)
    try {
      const r = await patientsApi.resendInvite(id)
      flash(r.inviteStatus === 'sent' ? 'Invite sent' : 'The invite could not be sent. Try again later.')
      const d = await patientsApi.get(id); setState((s) => ({ ...s, patient: d.patient }))
    } catch (e) { flash(e.message) } finally { setInviteBusy(false) }
  }
  const header = p || summary

  return (
    <Dialog
      wide title={header?.name || 'Patient'} onClose={onClose} labelId="pm-detail-title"
      footer={(
        <>
          <button type="button" className="pm-btn light" onClick={onClose}>Close</button>
          <button type="button" className="pm-btn primary" disabled={!p} onClick={() => navigate(`/therapist/notes-progress?patient=${id}`)}>Open full progress <ArrowRight size={16} aria-hidden="true" /></button>
        </>
      )}
    >
      {state.loading && !header ? <div className="pm-skel-block" aria-busy="true" /> : state.error ? (
        <div className="pm-error-box" role="alert"><AlertTriangle size={18} aria-hidden="true" /> {state.gone ? 'This patient is no longer available. They may have been deleted or moved.' : state.error}</div>
      ) : (
        <>
          <div className="pm-detail-head">
            <Avatar id={id} name={header.name} photoUrl={header.photoUrl} size={64} />
            <div className="pm-detail-who">
              <div className="pm-detail-badges">
                <StatusBadge status={header.status} />
                {header.age != null && <span className="pm-chip">Age {header.age}</span>}
                {header.condition && <span className="pm-chip">{header.condition}</span>}
              </div>
            </div>
            <div className="pm-detail-actions">
              <button type="button" className="pm-btn light" disabled={header.status === 'archived'} onClick={() => onBook(header)}><CalendarPlus size={16} aria-hidden="true" /> Book session</button>
              <button type="button" className="pm-btn light" onClick={() => onMessage(header)}><Mail size={16} aria-hidden="true" /> Message guardian</button>
            </div>
          </div>

          <div className="pm-stat-trio">
            <div><span>Total sessions</span><strong>{header.sessions}</strong></div>
            <div><span>Last session</span><strong>{fmtDay(header.lastSession) || 'None yet'}</strong></div>
            <div><span>Next session</span>{header.nextSession ? <strong>{fmtDay(header.nextSession)}</strong> : <em className="pm-pill amber">Not booked</em>}</div>
          </div>

          {p && (
            <div className="pm-two-col">
              <section className="pm-card">
                <h3>Guardian</h3>
                <Field label="Name" value={[p.guardian.name, p.guardian.relationship && `(${p.guardian.relationship})`].filter(Boolean).join(' ')} />
                <Field label="Contact" value={p.guardian.contact ? prettyPhone(p.guardian.contact) : null} onCopy={p.guardian.contact ? ((v, l) => copy(p.guardian.contact, l)) : null} />
                <Field label="Email" value={p.guardian.email} onCopy={copy} />
                {(p.inviteStatus === 'failed' || p.inviteStatus === 'pending') && (
                  <button type="button" className="pm-link-btn" onClick={resend} disabled={inviteBusy}><RefreshCw size={14} aria-hidden="true" /> {inviteBusy ? 'Sending…' : 'Resend invite'}</button>
                )}
              </section>
              <section className="pm-card">
                <h3>Patient info</h3>
                <Field label="Patient ID" value={p.patientCode} onCopy={copy} />
                <Field label="Joined" value={fmtJoined(p.joined)} />
                <Field label="Condition" value={p.condition} />
              </section>
            </div>
          )}
          {!p && state.loading && <div className="pm-skel-block short" aria-busy="true" />}
        </>
      )}
    </Dialog>
  )
}

