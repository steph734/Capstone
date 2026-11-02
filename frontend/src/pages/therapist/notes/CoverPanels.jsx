import { useEffect, useState } from 'react'
import { Ban, Check, Clock, Lock, TriangleAlert, X } from 'lucide-react'
import { acceptCoverShare, accessText, coverContext, coverLog, declineCoverShare, endsText, firstName, fmtDay, fmtTime, handBackCoverShare, time12 } from './coverApi'
import './cover.css'

const STEPS = [['shared', 'Shared'], ['accepted', 'Accepted'], ['writing', 'Writing'], ['signed', 'Signed']]
const stepsDone = (s) => STEPS.filter(([k]) => s.steps[k]).length
const initials = (n) => String(n || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
const REASONS = [['busy_at_that_time', 'I have another session at that time'], ['not_my_area', 'Not my area of therapy'], ['too_many_patients', 'Too many patients today'], ['other', 'Other']]

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
    const t = live ? setInterval(() => { if (!document.hidden) { load(); onReload?.() } }, 20000) : null
    return () => { alive = false; if (t) clearInterval(t) }
  }, [share.id, share.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const badge = share.status === 'completed' ? `Signed by ${cover} (covering)`
    : share.status === 'declined' ? `Declined by ${first}${share.declineReasonText ? ` – ${share.declineReasonText.toLowerCase()}` : ''}`
      : share.status === 'revoked' ? 'Sharing stopped' : share.status === 'expired' ? 'Request expired'
        : share.status === 'pending' ? `Waiting for ${first} to accept` : `Accepted by ${first}`
  const tone = share.status === 'completed' ? 'green' : share.status === 'pending' ? 'amber' : share.status === 'accepted' ? 'blue' : 'grey'
  const reshare = share.status === 'declined' || share.status === 'revoked' || share.status === 'expired'
  return (
    <section className="cv-card" aria-label="Shared with a therapist">
      <div className="cv-card-top">
        <b>{fmtDay(share.sessionDate)}, {share.sessionDate?.slice(0, 4)} · {time12(share.sessionStart)}</b>
        <span className={`cv-badge ${tone}`}>{badge}</span>
        {live && <span className="cv-badge ghost">{accessText(share)}</span>}
      </div>
      <ol className="cv-steps" aria-label="Progress">
        {STEPS.map(([k, label], i) => (
          <li key={k} className={i < done ? 'on' : ''}><i /><b>{label}</b><small>{share.steps[k] ? fmtTime(share.steps[k]) : '—'}</small></li>
        ))}
      </ol>
      {share.status === 'pending' && <p className="cv-note">{first} hasn&apos;t answered yet. {first} can&apos;t open the note until accepting.</p>}
      {share.status === 'accepted' && <p className="cv-note">Access ends {share.endsKind === 'signed' ? `when ${first} signs the note` : endsText(share).toLowerCase()}. You&apos;ll get the signed note back in your list.</p>}
      {share.status === 'declined' && (
        <p className="cv-note warn">{first} declined{share.declineReasonText ? `: ${share.declineReasonText}` : ''}.{share.declineMessage ? ` “${share.declineMessage}”` : ''} Pick another therapist so the note is covered.</p>
      )}
      {share.status === 'expired' && <p className="cv-note warn">{first} didn&apos;t answer before the session started. Pick another therapist.</p>}
      <div className="cv-btns">
        {share.noteId && share.status !== 'declined' && <button type="button" className="cv-btn primary" onClick={() => onView(share.noteId)}>View note</button>}
        {reshare && <button type="button" className="cv-btn primary" onClick={() => onChange(share)}>Share with another therapist</button>}
        {live && <button type="button" className="cv-btn" onClick={() => onChange(share)}>Change therapist</button>}
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

// Rene: "Decline this request?" with a required reason.
function DeclineModal({ share, onClose, onDeclined }) {
  const [reason, setReason] = useState('busy_at_that_time')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const owner = firstName(share.owner.name)
  const go = async () => {
    setBusy(true); setError('')
    try { await declineCoverShare(share.id, { reason, message }); onDeclined() } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal cv-narrow" role="dialog" aria-modal="true" aria-labelledby="cv-dec" onClick={(e) => e.stopPropagation()}>
        <h3 id="cv-dec">Decline this request?</h3>
        <p className="cv-help">{owner} will be told right away so he/she can share {share.patientName}&apos;s note with another therapist.</p>
        <h4 className="cv-label">Reason</h4>
        <div role="radiogroup" aria-label="Reason">
          {REASONS.map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={reason === v} className={`cv-row${reason === v ? ' on' : ''}`} onClick={() => setReason(v)}>
              <span className={`cv-radio${reason === v ? ' on' : ''}`} /><b>{label}</b>
            </button>
          ))}
        </div>
        <h4 className="cv-label">Message to {owner} <span className="cv-muted">(optional)</span></h4>
        <textarea className="cv-text" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Sorry, I'm fully booked tonight." />
        {error && <p className="cv-error" role="alert">{error}</p>}
        <div className="cv-actions">
          <button type="button" className="cv-btn" onClick={onClose}>Go back</button>
          <button type="button" className="cv-btn red" disabled={busy} onClick={go}>{busy ? 'Declining…' : 'Decline request'}</button>
        </div>
      </div>
    </div>
  )
}

// Rene: the "Shared with me" detail panel: a request to answer, then the accepted view.
export function CoverDetail({ patient, share, meName, onNewNote, onContinue, onChanged, onFlash }) {
  const [modal, setModal] = useState(null)
  const [declining, setDeclining] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = share.status === 'pending'
  const accepted = share.status === 'accepted'
  const owner = share.owner.name
  const first = firstName(owner)
  const todayKey = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const when = `${share.sessionDate === todayKey ? 'Today' : fmtDay(share.sessionDate)}, ${time12(share.sessionStart)}`

  const accept = async () => {
    setBusy(true); setError('')
    try { await acceptCoverShare(share.id); onFlash?.(`You accepted. You can now write ${patient.name}'s SOAP note. ${first} has been notified.`); onChanged?.() } catch (e) { setError(e.message); onChanged?.() } finally { setBusy(false) }
  }
  const handBack = async () => {
    if (!window.confirm(`Hand this note back to ${first}? ${first} will be told right away.`)) return
    setBusy(true); setError('')
    try { await handBackCoverShare(share.id); onFlash?.(`You handed ${patient.name}'s note back to ${first}.`); onChanged?.() } catch (e) { setError(e.message); setBusy(false) }
  }

  const status = pending ? ['Waiting for your answer', 'amber']
    : accepted ? [share.noteStatus === 'draft' ? 'Accepted · draft' : share.noteStatus === 'signed' ? 'Signed' : 'Accepted · note not started', 'green']
      : share.status === 'completed' ? ['Signed', 'green'] : share.status === 'declined' ? ['Declined', 'grey'] : ['Ended', 'grey']

  const info = (
    <div className="cv-info">
      <div><small>SHARED BY</small><b>{owner} · absent</b></div>
      <div><small>{pending ? 'ACCESS IF YOU ACCEPT' : 'YOUR ACCESS'}</small><b>{accessText(share)}</b></div>
      <div className="wide"><small>ACCESS ENDS</small><b>{share.endsKind === 'signed' ? 'When you sign the note' : endsText(share)}</b></div>
    </div>
  )
  const message = (
    <div className="cv-msg"><small>Message from {first}</small>{share.message ? <p>{share.message}</p> : <p className="cv-muted"><i>No message.</i></p>}</div>
  )

  return (
    <div className="cv-detail">
      <div className="cv-detail-top">
        <div><h3>{patient.name}</h3><p>{patient.diagnosis} · {share.sessionType || 'Session'} · {when}</p></div>
      </div>
      <span className={`cv-status ${status[1]}`}>{status[0]}</span>

      {pending && (
        <>
          <div className="cv-request">
            <div className="cv-request-head">
              <span className="cv-avatar">{initials(owner)}</span>
              <div><b>{owner} wants you to cover this session</b><small>Sent today at {fmtTime(share.steps.shared)}</small></div>
            </div>
            {info}
            {message}
            <h4 className="cv-label sm">You&apos;ll also be able to see</h4>
            <div className="cv-chips static">
              {share.includePastNotes && <span>Past signed notes</span>}
              {share.includeGoals && <span>Goals &amp; diagnosis</span>}
              {share.includeGameProgress && <span>Game progress</span>}
              {!share.includePastNotes && !share.includeGoals && !share.includeGameProgress && <span className="cv-muted">Nothing extra.</span>}
            </div>
            {error && <p className="cv-error" role="alert">{error}</p>}
            <div className="cv-big-btns">
              <button type="button" className="cv-btn primary big" disabled={busy} onClick={accept}><Check size={18} aria-hidden="true" /> {busy ? 'Accepting…' : 'Accept request'}</button>
              <button type="button" className="cv-btn red-outline big" disabled={busy} onClick={() => setDeclining(true)}><X size={18} aria-hidden="true" /> Decline</button>
            </div>
          </div>
          <div className="cv-locked">
            <div className="cv-btns">
              <button type="button" className="cv-btn locked" disabled><Lock size={15} aria-hidden="true" /> + New session note</button>
              <button type="button" className="cv-btn locked" disabled><Lock size={15} aria-hidden="true" /> View past notes</button>
            </div>
            <p>Locked until you accept. The patient&apos;s notes stay private until then.</p>
          </div>
        </>
      )}

      {accepted && (
        <>
          <ol className="cv-steps" aria-label="Progress">
            {STEPS.map(([k, label], i) => <li key={k} className={i < stepsDone(share) ? 'on' : ''}><i /><b>{label}</b><small>{share.steps[k] ? fmtTime(share.steps[k]) : '—'}</small></li>)}
          </ol>
          {info}
          {message}
          <div className="cv-chips">
            {share.includePastNotes && <button type="button" onClick={() => setModal('past')}>Past signed notes</button>}
            {share.includeGoals && <button type="button" onClick={() => setModal('goals')}>Goals &amp; diagnosis</button>}
            {share.includeGameProgress && <button type="button" onClick={() => setModal('games')}>Game progress</button>}
          </div>
          {error && <p className="cv-error" role="alert">{error}</p>}
          <div className="cv-btns">
            {share.access === 'write_sign' && (share.noteId && share.noteStatus === 'draft'
              ? <button type="button" className="cv-btn primary" onClick={() => onContinue(share.noteId)}>Continue note</button>
              : <button type="button" className="cv-btn primary" onClick={onNewNote}>+ New session note</button>)}
            {share.access === 'view' && share.noteId && <button type="button" className="cv-btn primary" onClick={() => onContinue(share.noteId)}>View note</button>}
            {share.includePastNotes && <button type="button" className="cv-btn" onClick={() => setModal('past')}>View past notes</button>}
          </div>
          {share.access === 'write_sign' && (
            <p className="cv-note">Your note will be signed as &quot;{meName}, covering for {owner}&quot;.{!share.steps.writing && <> Can&apos;t do it anymore? <button type="button" className="cv-link" disabled={busy} onClick={handBack}>Hand it back to {first}</button></>}</p>
          )}
        </>
      )}

      {!pending && !accepted && <p className="cv-note">{share.status === 'completed' ? 'You signed this note. Your access has ended.' : share.status === 'declined' ? `You declined this request. You have no access to ${patient.name}'s note.` : 'This share has ended.'}</p>}
      {modal && <ContextModal share={share} part={modal} onClose={() => setModal(null)} />}
      {declining && <DeclineModal share={share} onClose={() => setDeclining(false)} onDeclined={() => { setDeclining(false); onFlash?.(`You declined. ${first} has been told.`); onChanged?.() }} />}
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

// Page banners: a request is waiting for Rene / Edward is absent with patients still uncovered.
export function IncomingBanner({ share, onOpen }) {
  return (
    <div className="cv-banner amber" role="status">
      <Clock size={18} aria-hidden="true" /><span><b>New request: {share.owner.name} asked you to cover {share.patientName}&apos;s SOAP note. Accept or decline before the {time12(share.sessionStart)} session.</b></span>
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

// "Stop sharing?" confirmation (replaces the browser's plain confirm box).
export function StopShareModal({ share, busy, onCancel, onConfirm }) {
  const first = firstName(share.cover.name)
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onCancel, busy])
  return (
    <div className="cv-overlay" onClick={() => !busy && onCancel()}>
      <div className="cv-modal cv-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cv-stop" onClick={(e) => e.stopPropagation()}>
        <span className="cv-confirm-ico"><Ban size={26} aria-hidden="true" /></span>
        <h3 id="cv-stop">Stop sharing this note?</h3>
        <p>{first} loses access to {share.patientName}&apos;s note right away{share.steps.writing ? ', including the draft they started' : ''}. {first} will be told. You can share it with someone else afterwards.</p>
        <div className="cv-actions center">
          <button type="button" className="cv-btn" onClick={onCancel} disabled={busy} autoFocus>Keep sharing</button>
          <button type="button" className="cv-btn red" onClick={onConfirm} disabled={busy}>{busy ? 'Stopping…' : 'Stop sharing'}</button>
        </div>
      </div>
    </div>
  )
}
