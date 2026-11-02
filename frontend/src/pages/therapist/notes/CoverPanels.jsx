import { useEffect, useState } from 'react'
import { Check, Share2, TriangleAlert, X } from 'lucide-react'
import { acceptCoverShare, accessText, coverContext, coverLog, declineCoverShare, endsText, firstName, fmtDay, fmtTime, time12 } from './coverApi'
import './cover.css'

const STEPS = [['shared', 'Shared'], ['opened', 'Opened'], ['writing', 'Writing'], ['signed', 'Signed']]
const stepsDone = (s) => STEPS.filter(([k]) => s.steps[k]).length

// Edward: the note card for a shared session, with progress, the access log and the actions.
export function OwnerShareCard({ share, onView, onChange, onStop, onReload }) {
  const [log, setLog] = useState(null)
  const done = stepsDone(share)
  const live = share.status === 'pending' || share.status === 'accepted'
  const cover = share.cover.name
  const first = firstName(cover)
  useEffect(() => {
    let alive = true
    const load = () => coverLog(share.id).then((l) => { if (alive) setLog(l) }).catch(() => {})
    load()
    const t = live ? setInterval(() => { load(); onReload?.() }, 20000) : null
    return () => { alive = false; if (t) clearInterval(t) }
  }, [share.id, share.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const badge = share.status === 'completed' ? `Signed by ${cover} (covering)` : share.status === 'declined' ? `${first} declined` : share.status === 'revoked' ? 'Sharing stopped' : share.status === 'expired' ? 'Access expired' : `Shared with ${cover}`
  return (
    <section className="cv-card" aria-label="Shared with a therapist">
      <div className="cv-card-top">
        <b>{fmtDay(share.sessionDate)}, {share.sessionDate?.slice(0, 4)} · {time12(share.sessionStart)}</b>
        <span className={`cv-badge ${live ? 'blue' : share.status === 'completed' ? 'green' : 'grey'}`}>{badge}</span>
        {live && <span className="cv-badge ghost">{accessText(share)}</span>}
      </div>
      <ol className="cv-steps" aria-label="Progress">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={i < done ? 'on' : ''}><i /><b>{label}</b><small>{share.steps[k] ? fmtTime(share.steps[k]) : '—'}</small></li>
        ))}
      </ol>
      {live && <p className="cv-note">Access ends {share.endsKind === 'signed' ? `when ${first} signs the note` : `${endsText(share).toLowerCase()}`}. You&apos;ll get the signed note back in your list.</p>}
      {share.status === 'declined' && <p className="cv-note warn">{first} declined this handoff. Pick another therapist so the note is covered.</p>}
      <div className="cv-btns">
        {share.noteId && <button type="button" className="cv-btn primary" onClick={() => onView(share.noteId)}>View note</button>}
        {(live || share.status === 'declined' || share.status === 'revoked' || share.status === 'expired') && <button type="button" className="cv-btn" onClick={() => onChange(share)}>{live ? 'Change therapist' : 'Share with someone else'}</button>}
        {live && <button type="button" className="cv-btn danger" onClick={() => onStop(share)}>Stop sharing</button>}
      </div>
      <h4 className="cv-label">Access log</h4>
      <ul className="cv-log">
        {log === null && <li className="cv-muted">Loading…</li>}
        {log && log.length === 0 && <li className="cv-muted">Nothing yet.</li>}
        {(log || []).map((l, i) => <li key={i}><b>{fmtTime(l.at)}</b> · {l.actor} {l.text}{l.detail ? ` (${l.detail})` : ''}</li>)}
      </ul>
    </section>
  )
}

// Rene: past notes, in a modal (only when the owner allowed them).
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="cv-modal-head"><h3>{title}</h3><button type="button" className="cv-x" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}
export function ContextModal({ share, part, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { coverContext(share.id, part).then(setData).catch((e) => setError(e.message)) }, [share.id, part])
  const title = part === 'past' ? 'Past signed notes' : part === 'goals' ? 'Goals & diagnosis' : 'Game progress'
  return (
    <Modal title={title} onClose={onClose}>
      {error && <p className="cv-error" role="alert">{error}</p>}
      {!data && !error && <p className="cv-muted">Loading…</p>}
      {part === 'past' && data && (data.notes.length === 0 ? <p className="cv-muted">No signed notes yet.</p> : data.notes.map((n) => (
        <article key={n.id} className="cv-past"><b>{fmtDay(String(n.date).slice(0, 10))} · {n.by}</b>
          {['subjective', 'objective', 'assessment', 'plan'].map((k) => <p key={k}><strong>{k[0].toUpperCase()}</strong> {n[k]}</p>)}</article>
      )))}
      {part === 'goals' && data && (<><p><strong>Diagnosis:</strong> {data.diagnosis || 'Not on file'}</p>{data.lastPlan && <p><strong>Plan from the last signed note ({fmtDay(String(data.lastPlanDate).slice(0, 10))}):</strong> {data.lastPlan}</p>}</>)}
      {part === 'games' && data && (data.plays.length === 0 ? <p className="cv-muted">No games played yet.</p> : <ul className="cv-log">{data.plays.map((p, i) => <li key={i}><b>{p.game}</b> · {p.accuracy != null ? `${p.accuracy}%` : '—'} · {p.hints} hint{p.hints === 1 ? '' : 's'}{p.atHome ? ' · at home' : ''}</li>)}</ul>)}
    </Modal>
  )
}

// Rene: the "Shared with me" detail panel.
export function CoverDetail({ patient, share, meName, onNewNote, onContinue, onChanged }) {
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = share.status === 'pending' || share.status === 'accepted'
  const owner = share.owner.name
  const first = firstName(owner)
  // Opening the panel counts as "opened" (the owner sees it).
  useEffect(() => { if (share.status === 'pending') acceptCoverShare(share.id).then(() => onChanged?.()).catch(() => {}) }, [share.id, share.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const status = share.noteStatus === 'signed' ? 'Signed' : share.noteStatus === 'draft' ? 'Draft' : 'Note not started'
  const decline = async () => {
    if (!window.confirm(`Decline this note? ${first} will be told and can pick someone else.`)) return
    setBusy(true); setError('')
    try { await declineCoverShare(share.id); onChanged?.() } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <div className="cv-detail">
      <div className="cv-detail-top">
        <div><h3>{patient.name}</h3><p>{patient.diagnosis} · {share.sessionType || 'Session'} · {share.sessionDate === new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) ? 'Today' : fmtDay(share.sessionDate)}, {time12(share.sessionStart)}</p></div>
        <span className={`cv-status ${share.noteStatus}`}>{status}</span>
      </div>
      <div className="cv-info">
        <div><small>SHARED BY</small><b>{owner} · absent</b></div>
        <div><small>YOUR ACCESS</small><b>{accessText(share)}</b></div>
        <div className="wide"><small>ACCESS ENDS</small><b>{share.endsKind === 'signed' ? 'When you sign the note' : endsText(share)}</b></div>
      </div>
      <div className="cv-msg"><small>Message from {first}</small>{share.message ? <p>{share.message}</p> : <p className="cv-muted"><i>No message.</i></p>}</div>
      <div className="cv-chips">
        {share.includePastNotes && <button type="button" onClick={() => setModal('past')}>Past signed notes</button>}
        {share.includeGoals && <button type="button" onClick={() => setModal('goals')}>Goals &amp; diagnosis</button>}
        {share.includeGameProgress && <button type="button" onClick={() => setModal('games')}>Game progress</button>}
      </div>
      {error && <p className="cv-error" role="alert">{error}</p>}
      {live ? (
        <div className="cv-btns">
          {share.access === 'write_sign' && (share.noteId && share.noteStatus === 'draft'
            ? <button type="button" className="cv-btn primary" onClick={() => onContinue(share.noteId)}>Continue note</button>
            : <button type="button" className="cv-btn primary" onClick={onNewNote}>+ New session note</button>)}
          {share.access === 'view' && share.noteId && <button type="button" className="cv-btn primary" onClick={() => onContinue(share.noteId)}>View note</button>}
          {share.includePastNotes && <button type="button" className="cv-btn" onClick={() => setModal('past')}>View past notes</button>}
          {!share.steps.writing && <button type="button" className="cv-btn danger" disabled={busy} onClick={decline}>Decline</button>}
        </div>
      ) : <p className="cv-note">{share.status === 'completed' ? 'You signed this note. Your access has ended.' : 'This share has ended.'}</p>}
      {live && share.access === 'write_sign' && <p className="cv-note">Your note will be signed as &quot;{meName}, covering for {owner}&quot;. {first} is notified when you sign.</p>}
      {modal && <ContextModal share={share} part={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

// Rene: the banner at the top of the SOAP form.
export function CoverFormBanner({ share, onPast }) {
  return (
    <div className="cv-form-banner">
      <div><small>YOU&apos;RE COVERING</small><b>{share.patientName} for {share.owner.name}</b>
        <span>{fmtDay(share.sessionDate)} · {share.owner.name} is absent · access ends {share.endsKind === 'signed' ? 'when you sign' : endsText(share)}</span></div>
      <div className="cv-form-banner-btns"><span className="cv-accepted"><Check size={15} aria-hidden="true" /> Accepted</span>{share.includePastNotes && <button type="button" onClick={onPast}>View past notes</button>}</div>
    </div>
  )
}
// Rene: the side panel next to the form (handoff message and what he may do).
export function CoverSidePanel({ share }) {
  const can = [['Write & sign the SOAP note', share.access === 'write_sign'], ['See past notes', share.includePastNotes], ['See goals & diagnosis', share.includeGoals], ['See game progress', share.includeGameProgress]]
  return (
    <aside className="cv-side">
      <h4>Handoff from {firstName(share.owner.name)}</h4>
      <div className="cv-msg">{share.message ? <p>{share.message}</p> : <p className="cv-muted"><i>No message.</i></p>}</div>
      <ul className="cv-can">{can.map(([t, ok]) => <li key={t} className={ok ? 'yes' : 'no'}>{ok ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />} {t}</li>)}</ul>
    </aside>
  )
}

// Page banners: Rene is handed a note / Edward is absent with patients still uncovered.
export function IncomingBanner({ share, onOpen }) {
  return (
    <div className="cv-banner blue" role="status">
      <Share2 size={18} aria-hidden="true" /><span><b>{share.owner.name} is absent today and shared {share.patientName}&apos;s SOAP note with you.</b></span>
      <button type="button" onClick={onOpen}>Open</button>
    </div>
  )
}
export function AbsentBanner({ count, onShare }) {
  return (
    <div className="cv-banner amber" role="status">
      <TriangleAlert size={18} aria-hidden="true" /><span><b>You&apos;re marked absent today.</b> {count} patient{count === 1 ? '' : 's'} need{count === 1 ? 's' : ''} a covering therapist for today&apos;s SOAP note.</span>
      <button type="button" onClick={onShare}>Share a note</button>
    </div>
  )
}
