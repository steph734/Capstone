import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, CalendarClock, CheckCircle2, Archive, Repeat } from 'lucide-react'
import useIdleBusy from '../../../hooks/useIdleBusy'
import { apptApi } from './api'
import { Avatar, Modal, StatusPill } from './ui'
import { fmt12, longDate, timeRange } from './format'

const Facts = ({ rows }) => <dl className="ap-facts">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

export function ViewModal({ appt, onClose, onAction }) {
  return (
    <Modal title="Appointment" onClose={onClose} size="md" labelId="ap-view-title"
      footer={(
        <>
          <button type="button" className="ap-btn light" onClick={onClose}>Close</button>
          {appt.can.message && <button type="button" className="ap-btn light" onClick={() => onAction('message', appt)}>Message guardian</button>}
          {appt.can.reschedule && <button type="button" className="ap-btn light" onClick={() => onAction('reschedule', appt)}>Reschedule</button>}
          {appt.can.complete && <button type="button" className="ap-btn primary" onClick={() => onAction('complete', appt)}>Mark as completed</button>}
        </>
      )}
    >
      <div className="ap-view-who"><Avatar id={appt.patientId || appt.id} name={appt.patientName} size={52} /><div><h3>{appt.patientName}</h3><StatusPill status={appt.status} />{appt.isArchived && <span className="ap-pill grey">Archived</span>}</div></div>
      <Facts rows={[
        ['Date', longDate(appt.date)], ['Time', timeRange(appt.start, appt.end)], ['Service', `${appt.service} session · ${appt.minutes} min`],
        ['Condition', appt.condition], ['Guardian', appt.guardianName], ['Guardian email', appt.guardianEmail],
      ]} />
    </Modal>
  )
}

// Pick another day and one of the free slots that day (the server checks it all again).
export function RescheduleModal({ appt, today, onClose, onDone }) {
  const [date, setDate] = useState(appt.date)
  const [slots, setSlots] = useState(null)
  const [start, setStart] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useIdleBusy('reschedule', busy)

  useEffect(() => {
    let live = true
    setSlots(null); setStart(''); setError('')
    apptApi.day(date).then((d) => { if (live) setSlots(d.closed ? [] : d.openSlots.filter((s) => !(date === appt.date && s.start === appt.start))) }).catch((e) => { if (live) { setSlots([]); setError(e.message) } })
    return () => { live = false }
  }, [date, appt.date, appt.start])

  const save = async () => {
    setBusy(true); setError('')
    try { const out = await apptApi.reschedule(appt.id, { date, start }); onDone(out) } catch (e) { setError(e.message || 'Could not reschedule.') } finally { setBusy(false) }
  }
  return (
    <Modal title="Reschedule" subtitle={`${appt.patientName} · now ${longDate(appt.date)}, ${fmt12(appt.start)}`} onClose={onClose} locked={busy} size="sm" labelId="ap-resched-title"
      footer={(<><button type="button" className="ap-btn light" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="ap-btn primary" onClick={save} disabled={!start || busy}>{busy ? <Loader2 size={15} className="ap-spin" aria-hidden="true" /> : <CalendarClock size={15} aria-hidden="true" />} Move session</button></>)}
    >
      <label className="ap-label" htmlFor="ap-rs-date">New date</label>
      <input id="ap-rs-date" type="date" className="ap-input" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* the native icon still works */ } }} />
      <p className="ap-label">Free slots</p>
      {slots === null ? <p className="ap-muted">Loading slots…</p> : slots.length === 0 ? <p className="ap-muted">No free slots on this day. The clinic may be closed.</p> : (
        <div className="ap-slots" role="radiogroup" aria-label="Free slots">
          {slots.map((s) => <button key={s.start} type="button" role="radio" aria-checked={start === s.start} className={start === s.start ? 'on' : ''} onClick={() => setStart(s.start)}>{timeRange(s.start, s.end)}</button>)}
        </div>
      )}
      <p className="ap-hint">The guardian is told about the new time by email and in the app.</p>
      {error && <p className="ap-inline-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
    </Modal>
  )
}

export function CompleteModal({ appt, onClose, onDone }) {
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useIdleBusy('complete', busy)
  const save = async () => {
    setBusy(true); setError('')
    try { onDone(await apptApi.complete(appt.id, remarks.trim() || undefined)) } catch (e) { setError(e.message || 'Could not mark the session as completed.') } finally { setBusy(false) }
  }
  return (
    <Modal title="Mark session as completed" subtitle="The parent is notified. This can’t be undone." onClose={onClose} locked={busy} size="sm" labelId="ap-complete-title"
      footer={(<><button type="button" className="ap-btn light" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="ap-btn primary" onClick={save} disabled={busy}>{busy ? <Loader2 size={15} className="ap-spin" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />} Mark as completed</button></>)}
    >
      <Facts rows={[['Patient', appt.patientName], ['When', `${longDate(appt.date)} · ${fmt12(appt.start)}`], ['Service', appt.service]]} />
      <label className="ap-label" htmlFor="ap-rem">Remarks <span className="ap-muted">(optional)</span></label>
      <textarea id="ap-rem" className="ap-input" rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="How did the session go?" disabled={busy} />
      {error && <p className="ap-inline-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
    </Modal>
  )
}

export function ArchiveModal({ appt, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => { setBusy(true); setError(''); try { await apptApi.archive(appt.id); onDone() } catch (e) { setError(e.message || 'Could not archive.') } finally { setBusy(false) } }
  return (
    <Modal title="Archive this appointment?" subtitle={`${appt.patientName} · ${longDate(appt.date)}`} onClose={onClose} locked={busy} size="sm" labelId="ap-archive-title"
      footer={(<><button type="button" className="ap-btn light" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="ap-btn amber" onClick={save} disabled={busy}>{busy ? <Loader2 size={15} className="ap-spin" aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />} Archive</button></>)}
    >
      <p>It moves to the Archived tab. You can restore it any time.</p>
      {error && <p className="ap-inline-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
    </Modal>
  )
}

export function RecommendPrompt({ appt, onYes, onClose }) {
  return (
    <Modal title="Session completed" subtitle={`Recommend another session for ${appt.patientName}?`} onClose={onClose} size="sm" labelId="ap-rec-title"
      footer={(<><button type="button" className="ap-btn light" onClick={onClose}>Not now</button><button type="button" className="ap-btn primary" onClick={onYes}><Repeat size={15} aria-hidden="true" /> Recommend a session</button></>)}
    >
      <p>The parent gets a link to book the next session.</p>
    </Modal>
  )
}
