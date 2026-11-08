import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { manilaDateKey } from '../../utils/manilaTime'
import NoteViewerSecure from './notes/NoteViewerSecure'
import ShareDialog from './notes/ShareDialog'
import ShareHub from './notes/ShareHub'
import { OwnerShareCard, CoverDetail, CoverFormBanner, CoverSidePanel, IncomingBanner, AbsentBanner, ContextModal, StopShareModal } from './notes/CoverPanels'
import { sharedByMe, sharedWithMe as fetchSharedWithMe, stopCoverShare, listAvailable, fmtDay as coverDay } from './notes/coverApi'
import { authFetch } from '../../utils/session'
import LockScreen, { useIdleLock } from './notes/IdleLock'
import { listNotes, createNote, updateDraft, signDraft, shareNote, unshareNote, openNote as fetchNoteById } from './notes/notesApi'
import { sendVoiceEntries, fetchVoiceLog, useVoiceAccess } from './notes/voiceApi'
import { VoiceBar, VoicePanel, SectionVoicePill, ClearSectionConfirm, VoiceDownloadMenu } from './notes/VoiceUI'
import useVoiceNotes from '../../hooks/useVoiceNotes'
import {
  Share2, Calendar, ChartColumn, CircleCheck, ClipboardList, Download, Eye, FileText, KeyRound, Lock, MessageSquare, PenLine, Stethoscope, Sun, TriangleAlert, User,
} from 'lucide-react'
import { unescapeHtml } from '../../utils/session'
import { saveLocal, getDoc, listDocs } from '../../offline/repo'
import OfflineDrafts from '../../offline/OfflineDrafts'
import SignaturePad from './notes/SignaturePad'

// authFetch errors carry an HTTP status; a failed fetch (no connection) does not.
const isNetworkError = (err) => !err?.status
import './TherapistNotesProgressPage.css'
import './notes/voice.css'
import './assign/homeSets/homeSets.css'

const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']

// ── Icons for the Notes Shell (KPI cards, pills, empty states) — the
// notebook editor below keeps its own emoji styling on purpose.
function NotesFileIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
}
function PencilLineIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
}
function ShareNodesIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
}
function InboxIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
}
function CheckCircleIcon({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><polyline points="8 12 11 15 16 9" /></svg>
}
function HomeIcon({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></svg>
}
function ClipboardListIcon({ size = 26 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
}

// Deterministic initials + a matching pastel color — same approach as the
// My Patients page, so a patient without a real profile photo still gets a
// stable, recognizable avatar circle.
const AVATAR_PALETTE = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#ffe4e6', fg: '#be123c' },
  { bg: '#e0f2fe', fg: '#0369a1' },
  { bg: '#fef9c3', fg: '#854d0e' },
]
function paletteFor(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function initialsFor(name) {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}

// 'YYYY-MM-DD' -> "Jun 30, 2026" / "Jun 30", matching how the old hardcoded
// demo notes were displayed.
function fmtNoteDate(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtNoteDateShort(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Metadata row from GET /api/notes/therapist-list. It never carries note text:
// the text is fetched one note at a time when it is opened (audited, hash-checked).
function fromApiNote(n) {
  return {
    id: n.id,
    date: fmtNoteDate(n.date),
    rawDate: String(n.date || '').slice(0, 10),
    coveredBy: n.coveredBy || null,
    shortDate: fmtNoteDateShort(n.date),
    status: n.status,
    voided: !!n.voided,
    signed: n.status === 'signed' && !n.voided,
    shareable: !!n.shared,
    sharedSections: n.sharedSections || [],
    addendaCount: n.addendaCount || 0,
    domain: n.domain || DOMAINS[0],
    voiceLogCount: n.voiceLogCount || 0,
  }
}

// ── Note Form ─────────────────────────────────────────────────────────────────
// Four SOAP sections (10–5000 characters each to sign). Signing needs a drawn
// signature AND the password typed again; "Save draft" needs neither. The
// server re-validates everything and encrypts the text before it is stored.
const SOAP_SECTIONS = [
  { key: 'subjective', label: 'Subjective', Icon: MessageSquare, hint: 'What the patient or guardian reported or felt...', cls: 'tnp-s' },
  { key: 'objective', label: 'Objective', Icon: Eye, hint: 'Accuracy, prompts needed, words produced…', cls: 'tnp-o' },
  { key: 'assessment', label: 'Assessment', Icon: ChartColumn, hint: 'Clinical interpretation of findings...', cls: 'tnp-a' },
  { key: 'plan', label: 'Plan', Icon: Sun, hint: 'Next steps and home program...', cls: 'tnp-p' },
]
const fieldErrStyle = { color: '#b91c1c', fontSize: 12, display: 'block', marginTop: 4 }
const VOICE_FLUSH_MS = 30000

// `home`: set when this is an auto-drafted HOME PRACTICE note opened from Assign Games (see homeSetDrafts.js). It adds the banner, per-section
// review ticks, the "Drafted from play data" card, Redraft, autosave, and blocks signing until every section is reviewed.
function NoteForm({ patient, initial, onSave, onEnsureDraft, onCancel, locked, cover = null, meName = '', home = null, onHomeBack = null, onReviewNext = null, onOpenSigned = null, refreshVersion = null }) {
  const [pastOpen, setPastOpen] = useState(false)
  // The note's date is set by the server. Show the server's date (or, when editing, the note's own date), never the browser clock.
  const [serverDate, setServerDate] = useState('')
  useEffect(() => {
    let alive = true
    fetch('/api/server-time').then((r) => r.json()).then((d) => { if (alive && d?.date) setServerDate(d.date) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const shownIso = initial?.date || serverDate
  const today = shownIso
    ? new Date(`${String(shownIso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Set by the server when saved'
  const [soap, setSoap] = useState(() => Object.fromEntries(SOAP_SECTIONS.map(({ key }) => [key, unescapeHtml(initial?.[key] || '')])))
  // Latest text, updated synchronously so back-to-back dictated phrases never overwrite each other.
  const soapRef = useRef(soap)
  const [sigData, setSigData] = useState(null)
  const pwRef = useRef(null) // the password lives only in the input element, never in React state
  const clearPassword = () => { if (pwRef.current) pwRef.current.value = '' }
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState(null) // 'signed' | 'draft'
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  // ── Home practice note: review state, edits, autosave ──
  const [reviewed, setReviewed] = useState(() => Object.fromEntries(SOAP_SECTIONS.map(({ key }) => [key, Boolean(home?.sections?.[key]?.reviewed)])))
  const reviewedRef = useRef(reviewed); reviewedRef.current = reviewed
  const editedRef = useRef(new Set()) // sections changed since the review state was last sent
  const [editedUi, setEditedUi] = useState(() => new Set(SOAP_SECTIONS.filter(({ key }) => home?.sections?.[key]?.edited).map(({ key }) => key)))
  const lastSavedRef = useRef('')
  const touch = (field) => {
    if (!home) return
    setReviewed((r) => (r[field] ? { ...r, [field]: false } : r)) // editing a reviewed section clears its tick
    editedRef.current.add(field)
    setEditedUi((s) => (s.has(field) ? s : new Set(s).add(field)))
  }
  const persistReview = async (next) => {
    if (!home) return
    try {
      const sent = [...editedRef.current]
      await authFetch('/api/therapist/home-sets/note-review', { method: 'POST', body: { noteId: home.noteId, reviewed: next || reviewedRef.current, edited: sent } })
      sent.forEach((f) => editedRef.current.delete(f))
    } catch { /* the next autosave tries again */ }
  }
  const toggleReviewed = (field) => { const next = { ...reviewedRef.current, [field]: !reviewedRef.current[field] }; setReviewed(next); persistReview(next) }
  const reviewedCount = Object.values(reviewed).filter(Boolean).length

  // ── Voice dictation ──
  const [noteId, setNoteId] = useState(initial?.id || null)
  const noteIdRef = useRef(initial?.id || null)
  const [savedLog, setSavedLog] = useState([])
  const [voiceMsg, setVoiceMsg] = useState('')
  const [clearTarget, setClearTarget] = useState(null)
  const access = useVoiceAccess()
  const flushingRef = useRef(false)
  const voiceRef = useRef(null)
  const saveDraftRef = useRef(() => {})

  const writeSoap = (next) => { soapRef.current = next; setSoap(next) }
  const setText = (section, text) => { writeSoap({ ...soapRef.current, [section]: text }); setErrors((x) => ({ ...x, [section]: '' })); touch(section) }
  const set = (field) => (e) => { writeSoap({ ...soapRef.current, [field]: e.target.value }); setErrors((x) => ({ ...x, [field]: '' })); touch(field) }
  if (!lastSavedRef.current) lastSavedRef.current = JSON.stringify(soapRef.current)

  // A voice log belongs to a saved note: create the draft first when needed.
  const ensureId = async () => {
    if (noteIdRef.current) return noteIdRef.current
    if (!Object.values(soapRef.current).some((v) => v.trim())) return null
    const id = await onEnsureDraft({ ...soapRef.current })
    noteIdRef.current = id
    setNoteId(id)
    return id
  }

  // Sends pending voice entries; true when nothing is left to retry.
  const flushVoice = async () => {
    const v = voiceRef.current
    if (!v || flushingRef.current) return false
    const pending = v.getPending()
    if (!pending.length) return true
    flushingRef.current = true
    try {
      const id = await ensureId()
      if (!id) return false
      for (let i = 0; i < pending.length; i += 100) {
        const batch = pending.slice(i, i + 100)
        await sendVoiceEntries(id, batch)
        v.markSent(batch.length)
      }
      setVoiceMsg('')
      return true
    } catch (err) {
      if (err.status === 403 || err.status === 409) { v.dropPending(); setVoiceMsg(err.status === 409 ? 'This note is signed, so its voice log is closed.' : err.message); return true }
      setVoiceMsg('Voice log not saved, retrying')
      return false
    } finally { flushingRef.current = false }
  }

  const voiceEnabled = access.allowed && !locked && !done
  const voice = useVoiceNotes({
    enabled: voiceEnabled,
    getText: (s) => soapRef.current[s] || '',
    setText,
    onSaveDraft: () => saveDraftRef.current(),
    onRequestClear: (s) => setClearTarget(s),
    onStopped: () => { flushVoice() },
  })
  voiceRef.current = voice

  // Entries already stored for a draft being edited.
  useEffect(() => {
    if (!initial?.id) return undefined
    let alive = true
    fetchVoiceLog(initial.id).then((rows) => alive && setSavedLog(rows)).catch(() => {})
    return () => { alive = false }
  }, [initial?.id])

  // Save unsent entries every 30 seconds while the mic is on.
  useEffect(() => {
    if (!voice.isListening) return undefined
    const t = setInterval(() => { flushVoice() }, VOICE_FLUSH_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isListening])

  const fullLog = [...savedLog, ...voice.log]
  const dictatedSections = new Set(fullLog.filter((e) => e.type === 'dictation').map((e) => e.section))
  const disabledReason = access.loading ? 'Checking your plan…' : 'Available on Silver and Gold'

  // Autosave the draft every few seconds while the text changes (home practice notes only), then send the review state.
  const busyRef = useRef(''); busyRef.current = busy
  useEffect(() => {
    if (!home || done || locked) return undefined
    const t = setInterval(async () => {
      const snap = JSON.stringify(soapRef.current)
      if (snap === lastSavedRef.current || busyRef.current) return
      try { await onSave({ ...soapRef.current, sign: false, noteId: noteIdRef.current }); lastSavedRef.current = snap; await persistReview() } catch { /* try again next tick */ }
    }, 6000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, done, locked])

  const redraftNote = async () => {
    if (!home || busy) return
    const replace = editedUi.size > 0 && window.confirm('Replace the sections you edited with a fresh draft from the play data?\n\nOK = replace my edits.  Cancel = keep what I typed.')
    try {
      const { text } = await authFetch('/api/therapist/home-sets/note-redraft', { method: 'POST', body: { noteId: home.noteId, replaceEdits: replace } })
      const next = Object.fromEntries(SOAP_SECTIONS.map(({ key }) => [key, unescapeHtml(text[key] || '')]))
      writeSoap(next); lastSavedRef.current = JSON.stringify(next)
      setReviewed(Object.fromEntries(SOAP_SECTIONS.map(({ key }) => [key, false]))); editedRef.current = new Set()
      if (replace) setEditedUi(new Set())
      await refreshVersion?.(home.noteId)
      setFormError('')
    } catch (err) { setFormError(err.message || 'Could not redraft the note.') }
  }
  const homeBlock = !home ? '' : soap.subjective.includes(home.mark) ? 'Replace the highlighted placeholder in Subjective with the caregiver report.' : reviewedCount < 4 ? `Review all 4 sections to sign (${reviewedCount} of 4 done).` : ''

  const submit = async (sign) => {
    const e = {}
    if (sign && homeBlock) { setFormError(homeBlock); return }
    if (sign && home) await persistReview()
    const password = pwRef.current?.value || '' // read once, used for this request only
    if (sign) {
      for (const { key } of SOAP_SECTIONS) {
        const len = soap[key].trim().length
        if (len < 10) e[key] = len === 0 ? 'This section is required.' : 'Write at least 10 characters.'
      }
      if (!sigData) e.signature = 'Draw and confirm your signature.'
      if (!password) e.password = 'Re-enter your password to sign.'
    } else if (!Object.values(soap).some((v) => v.trim())) e.subjective = 'Write something before saving a draft.'
    setErrors(e); setFormError('')
    if (Object.keys(e).length) { setFormError('Please fix the highlighted fields.'); return }
    setBusy(sign ? 'sign' : 'draft')
    try {
      // The voice log must be stored before signing, because signing closes it.
      if (sign && !(await flushVoice())) { setFormError('The voice log could not be saved yet. Please try again.'); return }
      const id = await onSave({ ...soap, sign, signatureData: sigData, password, noteId: noteIdRef.current })
      if (id) { noteIdRef.current = id; setNoteId(id) }
      if (sign) voice.stop()
      else await flushVoice()
      setDone(sign ? 'signed' : 'draft')
    } catch (err) {
      setErrors(err.fields || {})
      setFormError(err.message || 'Could not save this note.')
    } finally { clearPassword(); setBusy('') } // cleared after every attempt, success or not
  }
  saveDraftRef.current = () => { if (!busy) submit(false) }

  if (done === 'signed' && home) {
    return (
      <div className="tnp-saved-state hp-signed">
        <div className="tnp-saved-icon"><CircleCheck size={40} aria-hidden="true" /></div>
        <h3>Note signed and saved!</h3>
        <ul className="hp-check" style={{ textAlign: 'left' }}>
          <li className="on"><b>✓</b> Added to {patient.name}'s Notes &amp; Progress</li>
          <li className="on"><b>✓</b> Linked to Set {home.setNumber} results in Patient Stats</li>
          <li className="on"><b>✓</b> {home.nextSetNames.length ? `Recommended Set ${home.setNumber + 1} is now unlocked` : 'The next set is now unlocked'}</li>
        </ul>
        <p style={{ margin: 0 }}>Nothing is shared with the family until you choose. Open the signed note to share it, print it or add an addendum.</p>
        <div className="hp-next"><span><b>Review next set</b><br />Recommended games, reasons and objectives</span><button type="button" onClick={onReviewNext}>Review next set →</button></div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="tnp-ghost-btn" type="button" onClick={() => onOpenSigned?.(noteIdRef.current)}>Open signed note</button>
          <button className="tnp-ghost-btn" type="button" onClick={onCancel}>Back to Patient</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="tnp-saved-state">
        <div className="tnp-saved-icon">{done === 'signed' ? <CircleCheck size={40} aria-hidden="true" /> : <FileText size={40} aria-hidden="true" />}</div>
        <h3>{done === 'signed' ? 'Note signed & saved' : 'Draft saved'}</h3>
        <p>{done === 'signed' ? 'It is now read-only. Corrections can only be added as addenda.' : 'You can keep editing it until you sign.'} For <strong>{patient.name}</strong>.</p>
        <button className="tnp-primary-btn" onClick={onCancel}>Back to Patient</button>
      </div>
    )
  }

  return (
    <div className="cv-form-wrap">
    {cover && <CoverFormBanner share={cover} onPast={() => setPastOpen(true)} />}
    {home && (
      <div className="hp-banner">
        <img src="/games/pao-money-match-poses/pao-thumbs-up.png" alt="" width="64" height="64" />
        <div><b>Opened from Assign Games · {patient.name.split(' ')[0]}'s Set {home.setNumber} home practice note</b><p>Drafted automatically from play data. Review each section, add the caregiver report, then sign to unlock the next set.</p></div>
        <button type="button" className="tnp-ghost-btn" onClick={onHomeBack}>← Back to Assign Games</button>
      </div>
    )}
    <div className="vn-layout">
      <div className="vn-main">
        <div className="tnp-notebook">
          <div className="tnp-spiral" aria-hidden="true">{Array.from({ length: 14 }).map((_, i) => <div key={i} className="tnp-ring" />)}</div>
          <div className="tnp-paper">
            <div className="tnp-deco-tr"><ClipboardList size={22} aria-hidden="true" /></div>
            <div className="tnp-title-row">
              <h2 className="tnp-title">{home ? 'Home Practice Note' : initial ? 'Edit Draft' : 'Session Note'}</h2>
              <div className="tnp-date-box"><span className="tnp-field-label"><Calendar size={14} aria-hidden="true" /> Date:</span><span className="tnp-field-val tnp-field-line">{today}</span></div>
            </div>
            <div className="tnp-field-row"><span className="tnp-field-label"><User size={14} aria-hidden="true" /> Patient:</span><span className="tnp-field-val tnp-field-line">{patient.name}</span></div>
            {cover && <div className="tnp-field-row"><span className="tnp-field-label"><User size={14} aria-hidden="true" /> Therapist:</span><span className="tnp-field-val tnp-field-line">{meName} <span className="cv-pill">Covering for {cover.owner.name}</span></span></div>}
            <div className="tnp-field-row tnp-field-row-last"><span className="tnp-field-label"><Stethoscope size={14} aria-hidden="true" /> Diagnosis:</span><span className="tnp-field-val tnp-field-line">{home ? (home.diagnosis ? unescapeHtml(home.diagnosis) : <span style={{ color: '#9aa9a3', fontStyle: 'italic' }}>From patient profile</span>) : patient.diagnosis}</span></div>
            {home && <div className="tnp-field-row"><span className="tnp-field-label"><ClipboardList size={14} aria-hidden="true" /> Home set:</span><span className="tnp-field-val tnp-field-line">{unescapeHtml(home.label)}</span></div>}
            <div className="tnp-rule" />

            {voice.supported && <VoiceBar voice={voice} enabled={voiceEnabled} disabledReason={disabledReason} />}
            {voice.warning && <p className="vn-warn" role="status"><TriangleAlert size={14} aria-hidden="true" /> {voice.warning}</p>}

            {SOAP_SECTIONS.map(({ key, label, Icon, hint, cls }) => {
              const active = voice.isListening && voice.activeSection === key
              return (
                <div key={key} className={`tnp-section vn-section${active ? ' vn-active' : ''}`}>
                  <div className="vn-section-head">
                    <div className={`tnp-section-label ${cls}`}><Icon size={14} aria-hidden="true" /> {label}</div>
                    {home && (
                      <span className="hp-tags">
                        <span>{editedUi.has(key) ? 'Edited by you' : 'Auto-drafted'}</span>
                        {key === 'subjective' && soap.subjective.includes(home.mark) && <span className="warn">Needs your caregiver report</span>}
                        {key === 'assessment' && <span className="warn">Review: confirm your clinical view</span>}
                        {home.sections?.[key]?.basedOn?.map((b) => <span key={b} className="blue">{b}</span>)}
                      </span>
                    )}
                    {voice.supported && (
                      <SectionVoicePill listening={active} dictated={dictatedSections.has(key)} disabled={!voiceEnabled}
                        title={voiceEnabled ? `Dictate into ${label}` : disabledReason}
                        onClick={() => (voice.isListening ? voice.setActive(key) : voice.start(key))} />
                    )}
                  </div>
                  <textarea className="tnp-textarea" placeholder={hint} value={soap[key]} onChange={set(key)} rows={3} maxLength={5000}
                    onFocus={() => { if (voice.isListening) voice.setActive(key) }} aria-invalid={!!errors[key]} aria-label={label} />
                  {active && voice.interimText && <p className="vn-interim" aria-live="polite">{voice.interimText}<span className="vn-caret" aria-hidden="true" /></p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#6b7c75' }}>
                    <span>{errors[key] && <span role="alert" style={fieldErrStyle}>{errors[key]}</span>}</span>
                    <span>{soap[key].length} / 5000</span>
                  </div>
                  {home && <label className="hp-review"><input type="checkbox" checked={Boolean(reviewed[key])} onChange={() => toggleReviewed(key)} /> Mark as reviewed</label>}
                </div>
              )
            })}

            <div className="tnp-sig-section">
              <div className="tnp-sig-title"><PenLine size={15} aria-hidden="true" /> {cover ? 'Covering Therapist Signature' : 'Therapist Signature'}</div>
              {cover && <p className="cv-sigline">Signed as {meName}, covering for {cover.owner.name}. {cover.owner.name.split(' ')[0]} gets the signed note and is notified.</p>}
              <p className="tnp-sig-desc">Draw your signature, then re-enter your password to certify and lock this note. Signing can't be done by voice.</p>
              <SignaturePad onSign={(d) => { setSigData(d); setErrors((x) => ({ ...x, signature: '' })) }} onClear={() => setSigData(null)} />
              {errors.signature && <span role="alert" style={fieldErrStyle}>{errors.signature}</span>}
              <label className="tnp-field-label" htmlFor="sign-pw" style={{ display: 'block', marginTop: 12 }}><KeyRound size={14} aria-hidden="true" /> Your account password</label>
              <input id="sign-pw" ref={pwRef} type="password" name="note-signing-password" autoComplete="new-password" defaultValue="" className="vn-password"
                placeholder="Enter the password you use to sign in" aria-describedby="sign-pw-hint" aria-invalid={!!errors.password}
                onChange={() => setErrors((x) => ({ ...x, password: '' }))} />
              <p id="sign-pw-hint" className="vn-pw-hint">Use the password of the account you are signed in with (not a note password). It is checked by the server and never stored with the note.</p>
              {errors.password && <span role="alert" style={fieldErrStyle}>{errors.password}</span>}
            </div>

            {formError && <p role="alert" style={{ ...fieldErrStyle, fontSize: 13 }}>{formError}</p>}
            <div className="tnp-form-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
              {home && <p style={{ flex: '1 1 220px', margin: 0, fontSize: 13, color: '#6b7c75' }}>{homeBlock || 'All 4 sections reviewed. Sign to unlock the next set.'} Nothing is shared with the family until you choose.</p>}
              {home && <button className="tnp-ghost-btn" onClick={redraftNote} disabled={!!busy} type="button">↻ Redraft</button>}
              <button className="tnp-ghost-btn" onClick={onCancel} type="button">Cancel</button>
              <button className="tnp-ghost-btn" onClick={() => submit(false)} disabled={!!busy} type="button">{busy === 'draft' ? 'Saving…' : <><FileText size={15} aria-hidden="true" /> Save draft</>}</button>
              <button className="tnp-primary-btn" onClick={() => submit(true)} disabled={!!busy || Boolean(homeBlock)} title={homeBlock || ''} type="button">{busy === 'sign' ? 'Signing…' : <><Lock size={15} aria-hidden="true" /> {home ? 'Sign & save' : 'Sign & lock note'}</>}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="cv-aside">
      {home && (
        <section className="hp-side" aria-label="Drafted from play data">
          <h4>Drafted from play data <span className="hs-auto-pill" style={{ marginLeft: 6, fontSize: 12 }}>✨ Auto-draft</span></h4>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5b7469' }}>{reviewedCount} of 4 sections reviewed</p>
          <div className="hp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={reviewedCount}><i style={{ width: `${(reviewedCount / 4) * 100}%` }} /></div>
          <ul className="hp-check">
            {[['subjective', 'S', 'Caregiver report added'], ['objective', 'O', 'Numbers match the play data'], ['assessment', 'A', 'Assessment matches your view'], ['plan', 'P', `Plan matches Set ${home.setNumber + 1}`]].map(([k, l, t]) => (
              <li key={k} className={reviewed[k] ? 'on' : ''}><b aria-hidden="true">{reviewed[k] ? '✓' : ''}</b><span><b style={{ all: 'unset', fontWeight: 800 }}>{l}</b> {t}</span></li>
            ))}
          </ul>
          <div className="hp-scores"><p className="hs-cap" style={{ margin: '8px 0 2px' }}>PLAY SCORES USED</p>
            {home.scores.map((g) => (
              <div key={g.name}><span>{g.name}</span><span>{[0, 1, 2].map((i) => { const a = g.plays[i]; return <span key={i} className={a == null ? '' : a >= 80 ? 'hi' : 'lo'} style={{ marginLeft: 8 }}>{a == null ? '—' : `${a}%`}</span> })}</span></div>
            ))}
          </div>
          {home.history.length > 0 && <div className="hp-scores"><p className="hs-cap" style={{ margin: '10px 0 2px' }}>EDIT HISTORY</p>{home.history.slice(0, 5).map((h, i) => <div key={i}><span>{new Date(h.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}</span><span>{h.note || h.sections.join(', ')}</span></div>)}</div>}
        </section>
      )}
      {cover && <CoverSidePanel share={cover} />}
      <VoicePanel log={fullLog} noteId={noteId} supported={voice.supported} enabled={access.allowed} disabledReason={access.loading ? '' : 'Voice dictation is available on Silver and Gold.'}
        notice={voiceMsg} onBeforeDownload={flushVoice} />
      </div>

      {clearTarget && (
        <ClearSectionConfirm section={clearTarget} onCancel={() => setClearTarget(null)}
          onConfirm={() => { setText(clearTarget, ''); voice.clearUndo(clearTarget); setClearTarget(null) }} />
      )}
    </div>
    {pastOpen && cover && <ContextModal share={cover} part="past" onClose={() => setPastOpen(false)} />}
    </div>
  )
}

// ── Notes Shell (KPI cards + filter/search + patient list / note previews) ────
// This is the "overview" screen — a patient list on the left and, on the
// right, a preview of the selected patient's notes. Opening a note ("View")
// or starting a new one swaps this whole screen out for the notebook-styled
// NoteViewer/NoteForm below; it isn't touched by this component.
function statusPillClass(status) {
  if (status === 'Signed') return 'tnp2-pill tnp2-pill-signed'
  if (status === 'Draft') return 'tnp2-pill tnp2-pill-draft'
  return 'tnp2-pill tnp2-pill-none'
}

const PATIENT_FILTERS = ['All', 'Needs signing', 'Signed', 'No notes']

const PAGE_SIZE = 5
const MOBILE_QUERY = '(max-width: 767px)'

function useIsMobile() {
  const get = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

// Nearest ancestor that actually scrolls (the page shell scrolls its own
// content area), falling back to the window.
function getScroller(el) {
  let node = el?.parentElement
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return window
}
const scrollTopOf = (s) => (s === window ? window.scrollY : s.scrollTop)
const scrollToY = (s, y) => (s === window ? window.scrollTo(0, y) : (s.scrollTop = y))

function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
}
function ChevronLeftIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 6 9 12 15 18" /></svg>
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="5 12 10 17 19 7" /></svg>
}

function NotesShell({ patients, notes, selectedId, onSelect, onBack, onNewNote, onViewNote, onEditDraft, onShareNote, onUnshare, isMobile, coverUi }) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSearch, setSheetSearch] = useState('')
  const [voiceFor, setVoiceFor] = useState(null)
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const savedScroll = useRef(null)

  const changeFilter = (f) => { setFilter(f); setVisible(PAGE_SIZE) }
  const changeSearch = (v) => { setSearch(v); setVisible(PAGE_SIZE) }

  const mobileDetail = isMobile && selectedId != null
  const showList = !mobileDetail

  // Remember the list scroll position when a patient opens (mobile) and put
  // it back when returning; open the notes screen at the top.
  const openPatient = (id) => {
    if (isMobile) savedScroll.current = scrollTopOf(getScroller(rootRef.current))
    onSelect(id)
  }
  useLayoutEffect(() => {
    if (!isMobile) return
    const s = getScroller(rootRef.current)
    if (mobileDetail) scrollToY(s, 0)
    else if (savedScroll.current != null) { scrollToY(s, savedScroll.current); savedScroll.current = null }
  }, [mobileDetail, isMobile])

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const statusFor = (p) => {
    if (p.cover) return 'Shared with me'
    const pNotes = notes[p.id] || []
    if (pNotes.length === 0) return 'No notes'
    return pNotes[0].signed ? 'Signed' : 'Draft'
  }

  const allNotesFlat = Object.values(notes).flat()
  const kpi = {
    total: allNotesFlat.length,
    drafts: allNotesFlat.filter(n => !n.signed).length,
    shared: allNotesFlat.filter(n => n.shareable).length,
    noNotes: patients.filter(p => (notes[p.id] || []).length === 0).length,
  }

  const isOut = (p) => Boolean(p.out) && ['pending', 'accepted', 'completed'].includes(p.out.status)
  const outCount = patients.filter(isOut).length
  const inCount = patients.filter((p) => p.cover).length
  const FILTERS = [...PATIENT_FILTERS, ...(outCount ? ['Shared'] : []), ...(inCount ? ['Shared with me'] : [])]
  const activeFilter = FILTERS.includes(filter) ? filter : 'All'
  const counts = {
    Shared: outCount, 'Shared with me': inCount,
    All: patients.length,
    'Needs signing': patients.filter(p => statusFor(p) === 'Draft').length,
    Signed: patients.filter(p => statusFor(p) === 'Signed').length,
    'No notes': patients.filter(p => statusFor(p) === 'No notes').length,
  }

  const filteredPatients = patients.filter(p => {
    const status = statusFor(p)
    const matchFilter =
      activeFilter === 'All' ? true :
      activeFilter === 'Needs signing' ? status === 'Draft' :
      activeFilter === 'Signed' ? status === 'Signed' :
      activeFilter === 'Shared' ? isOut(p) :
      activeFilter === 'Shared with me' ? Boolean(p.cover) :
      status === 'No notes'
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.diagnosis.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const selectedPatient = patients.find(p => p.id === selectedId)
  const patientNotes = selectedId != null ? (notes[selectedId] || []) : []

  // Show-more paging: the selected patient is always kept inside the visible slice.
  const selIdx = filteredPatients.findIndex(p => p.id === selectedId)
  const shown = Math.min(filteredPatients.length, Math.max(visible, selIdx + 1))
  const allShown = shown >= filteredPatients.length
  const pagedPatients = filteredPatients.slice(0, shown)
  const togglePaging = () => {
    if (!allShown) { setVisible(shown + PAGE_SIZE); return }
    setVisible(PAGE_SIZE)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sheetQ = sheetSearch.trim().toLowerCase()
  const sheetPatients = patients.filter(p => !sheetQ || p.name.toLowerCase().includes(sheetQ) || p.diagnosis.toLowerCase().includes(sheetQ))
  const closeSheet = () => { setSheetOpen(false); setSheetSearch('') }

  const notesBlock = patientNotes.length === 0 ? (
    <div className="tnp2-empty-notes">
      <ClipboardListIcon />
      <span>No session notes yet for this patient.</span>
    </div>
  ) : (
    <div className="tnp2-note-list">
      {patientNotes.map(n => (
        <div key={n.id} className="tnp2-note-card">
          <div className="tnp2-note-card-top">
            <span className="tnp2-note-date">{n.date}</span>
            <span className={n.signed ? 'tnp-signed-pill' : 'tnp-pending-pill'}>
              {n.voided ? 'Void' : n.signed ? <><CheckCircleIcon /> Signed</> : 'Draft'}
            </span>
            <span className={n.shareable ? 'tnp-shared-pill' : 'tnp2-private-pill'}>
              {n.shareable ? <><HomeIcon /> Shared · {n.sharedSections.length ? n.sharedSections.join(', ') : 'summary'}</> : 'Private'}
            </span>
            {n.addendaCount > 0 && <span className="tnp2-private-pill">{n.addendaCount} addend{n.addendaCount === 1 ? 'um' : 'a'}</span>}
          </div>
          <p className="tnp2-note-preview">Open the note to read it — every view is logged.</p>
          <div className="tnp2-note-actions">
            <button className="tnp-table-view-btn" onClick={() => onViewNote(n)}>View</button>
            {n.status === 'draft' && !n.voided && <button className="tnp2-share-btn" onClick={() => onEditDraft(n)}>Edit</button>}
            {n.signed && (n.shareable
              ? <button className="tnp2-share-btn" onClick={() => onUnshare(n)}>Unshare</button>
              : <button className="tnp2-share-btn" onClick={() => onShareNote(n)}>Share…</button>)}
            {n.voiceLogCount > 0 && (
              <span className="vn-list-anchor">
                <button className="tnp2-share-btn" onClick={() => setVoiceFor(voiceFor === n.id ? null : n.id)} aria-expanded={voiceFor === n.id}><Download size={13} aria-hidden="true" /> Voice log</button>
                {voiceFor === n.id && <VoiceDownloadMenu noteId={n.id} onClose={() => setVoiceFor(null)} floating />}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  const detailBody = !selectedPatient ? null : selectedPatient.cover ? (
    <CoverDetail patient={selectedPatient} share={selectedPatient.cover} meName={coverUi.meName} onNewNote={onNewNote} onContinue={(id) => onViewNote({ id })} onChanged={coverUi.onChanged} onFlash={coverUi.onFlash} />
  ) : (
    <>
      {selectedPatient.out && (
        <OwnerShareCard share={selectedPatient.out} onView={(id) => onViewNote({ id })} onChange={(sh) => coverUi.onChange(selectedPatient, sh)} onStop={coverUi.onStop} onReload={coverUi.onRefresh} />
      )}
      {notesBlock}
    </>
  )

  return (
    <div className="tnp2-shell" ref={rootRef}>
      {showList && (<>
      {/* KPI cards */}
      <div className={`tnp2-kpi-grid${outCount || inCount ? ' cv-five' : ''}`}>
        <div className="tnp2-kpi-card">
          <span className="tnp2-kpi-icon tnp2-kpi-icon-total"><NotesFileIcon /></span>
          <div className="tnp2-kpi-text">
            <span className="tnp2-kpi-num">{kpi.total}</span>
            <span className="tnp2-kpi-lbl">Total notes</span>
          </div>
        </div>
        <div className="tnp2-kpi-card">
          <span className="tnp2-kpi-icon tnp2-kpi-icon-draft"><PencilLineIcon /></span>
          <div className="tnp2-kpi-text">
            <span className="tnp2-kpi-num">{kpi.drafts}</span>
            <span className="tnp2-kpi-lbl">Unsigned drafts</span>
          </div>
        </div>
        <div className="tnp2-kpi-card">
          <span className="tnp2-kpi-icon tnp2-kpi-icon-shared"><ShareNodesIcon /></span>
          <div className="tnp2-kpi-text">
            <span className="tnp2-kpi-num">{kpi.shared}</span>
            <span className="tnp2-kpi-lbl">Shared with parents</span>
          </div>
        </div>
        {outCount > 0 && (
          <div className="tnp2-kpi-card cv-kpi">
            <span className="tnp2-kpi-icon tnp2-kpi-icon-shared"><Share2 size={18} aria-hidden="true" /></span>
            <div className="tnp2-kpi-text"><span className="tnp2-kpi-num">{outCount}</span><span className="tnp2-kpi-lbl">Shared with therapists</span></div>
          </div>
        )}
        {inCount > 0 && (
          <div className="tnp2-kpi-card cv-kpi">
            <span className="tnp2-kpi-icon tnp2-kpi-icon-shared"><Share2 size={18} aria-hidden="true" /></span>
            <div className="tnp2-kpi-text"><span className="tnp2-kpi-num">{inCount}</span><span className="tnp2-kpi-lbl">Shared with me</span></div>
          </div>
        )}
        <div className="tnp2-kpi-card">
          <span className="tnp2-kpi-icon tnp2-kpi-icon-empty"><InboxIcon /></span>
          <div className="tnp2-kpi-text">
            <span className="tnp2-kpi-num">{kpi.noNotes}</span>
            <span className="tnp2-kpi-lbl">No notes yet</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="tnp2-toolbar">
        <div className="tnp2-filter-tabs">
          {FILTERS.map(f => (
            <button key={f} className={`tnp2-filter-tab ${activeFilter === f ? 'active' : ''}`} onClick={() => changeFilter(f)}>
              {f} <span className="tnp2-filter-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="tnp2-search-wrap">
          <svg className="tnp2-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="tnp2-search"
            placeholder="Search patient or diagnosis…"
            value={search}
            onChange={e => changeSearch(e.target.value)}
          />
        </div>
      </div>
      </>)}

      {/* Two-pane split (one pane at a time on phones) */}
      <div className={`tnp2-split${mobileDetail ? ' tnp2-split-detail' : ''}`}>
        {showList && (
        <div className="tnp2-list-pane" ref={listRef}>
          {filteredPatients.length === 0 ? (
            <p className="tnp2-list-empty">No patients match.</p>
          ) : pagedPatients.map(p => {
            const pNotes = notes[p.id] || []
            const status = statusFor(p)
            const pal = paletteFor(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`tnp2-list-row${selectedId === p.id ? ' active' : ''}`}
                onClick={() => openPatient(p.id)}
              >
                <span className="tnp2-avatar" style={{ background: pal.bg, color: pal.fg }}>
                  {initialsFor(p.name)}
                </span>
                <div className="tnp2-list-row-info">
                  <div className="tnp2-list-row-top">
                    <span className="tnp2-list-row-name">{p.name}</span>
                    {p.cover ? <span className={`cv-pill ${p.cover.status === 'pending' ? 'amber' : p.cover.status === 'accepted' || p.cover.status === 'completed' ? 'green' : 'grey'}`}>{p.cover.status === 'pending' ? 'New request' : p.cover.status === 'accepted' ? 'Accepted' : p.cover.status === 'completed' ? 'Signed' : 'Declined'}</span> : <><span className={statusPillClass(status)}>{status}</span>{isOut(p) && <span className="cv-pill">Shared</span>}</>}
                  </div>
                  <span className="tnp2-list-row-sub">{p.cover ? `From ${p.cover.owner.name} · today` : isOut(p) ? `${p.diagnosis} · with ${p.out.cover.name}` : `${p.diagnosis} · ${pNotes.length} note${pNotes.length === 1 ? '' : 's'}`}</span>
                </div>
                <span className="tnp2-chevron" aria-hidden="true"><ChevronRightIcon /></span>
              </button>
            )
          })}
          {filteredPatients.length > PAGE_SIZE && (
            <div className="tnp2-pager">
              <button type="button" className="tnp2-pager-btn" onClick={togglePaging}>
                {allShown ? 'Show less ▴' : 'See more ▾'}
              </button>
              <span className="tnp2-pager-count">Showing {shown} of {filteredPatients.length} patients</span>
            </div>
          )}
        </div>
        )}

        <div className="tnp2-detail-pane">
          {!selectedPatient ? (
            <div className="tnp2-detail-empty">Select a patient to see their notes.</div>
          ) : isMobile ? (
            <>
              <div className="tnp2-m-header">
                <button type="button" className="tnp2-m-back" onClick={onBack} aria-label="Back to patient list">
                  <ChevronLeftIcon />
                </button>
                <div className="tnp2-m-title">
                  <h3>{selectedPatient.name}</h3>
                  <p>Session notes</p>
                </div>
              </div>
              <div className="tnp2-m-patient">
                <span
                  className="tnp2-avatar tnp2-avatar-lg"
                  style={{ background: paletteFor(selectedPatient.id).bg, color: paletteFor(selectedPatient.id).fg }}
                >
                  {initialsFor(selectedPatient.name)}
                </span>
                <div className="tnp2-detail-meta">
                  <h3>{selectedPatient.name}</h3>
                  <p>{selectedPatient.diagnosis} · {patientNotes.length} note{patientNotes.length === 1 ? '' : 's'}</p>
                </div>
                <button type="button" className="tnp2-switch-btn" onClick={() => setSheetOpen(true)}>Switch ▾</button>
              </div>
              {!selectedPatient.cover && (
                <div className="cv-hdr-btns">
                  <button type="button" className="tnp2-new-note-btn tnp2-new-note-primary" onClick={onNewNote}>+ New session note</button>
                  <button type="button" className="cv-share-btn" onClick={() => coverUi.onShare(selectedPatient)}><Share2 size={16} aria-hidden="true" /> Share…</button>
                </div>
              )}
              {!selectedPatient.cover && <div className="tnp2-m-label">Session notes</div>}
              {detailBody}
            </>
          ) : (
            <>
              <div className="tnp2-detail-header">
                <span
                  className="tnp2-avatar tnp2-avatar-lg"
                  style={{ background: paletteFor(selectedPatient.id).bg, color: paletteFor(selectedPatient.id).fg }}
                >
                  {initialsFor(selectedPatient.name)}
                </span>
                <div className="tnp2-detail-meta">
                  <h3>{selectedPatient.name}</h3>
                  <p>{selectedPatient.diagnosis} · {patientNotes.length} note{patientNotes.length === 1 ? '' : 's'}</p>
                </div>
                {!selectedPatient.cover && (
                  <div className="cv-hdr-btns">
                    <button className="tnp2-new-note-btn" onClick={onNewNote}>+ New session note</button>
                    <button type="button" className="cv-share-btn" onClick={() => coverUi.onShare(selectedPatient)}><Share2 size={16} aria-hidden="true" /> Share…</button>
                  </div>
                )}
              </div>
              {detailBody}
            </>
          )}
        </div>
      </div>

      {sheetOpen && (
        <div className="tnp2-sheet-backdrop" onClick={closeSheet}>
          <div className="tnp2-sheet" role="dialog" aria-modal="true" aria-label="Switch patient" onClick={e => e.stopPropagation()}>
            <div className="tnp2-sheet-grab" aria-hidden="true" />
            <h3 className="tnp2-sheet-title">Switch patient</h3>
            <div className="tnp2-search-wrap">
              <svg className="tnp2-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="tnp2-search"
                placeholder="Search patient…"
                value={sheetSearch}
                onChange={e => setSheetSearch(e.target.value)}
              />
            </div>
            <div className="tnp2-sheet-list">
              {sheetPatients.length === 0 && <p className="tnp2-list-empty">No patients match.</p>}
              {sheetPatients.map(p => {
                const n = (notes[p.id] || []).length
                const pal = paletteFor(p.id)
                const current = p.id === selectedId
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`tnp2-list-row${current ? ' active' : ''}`}
                    onClick={() => { if (!current) onSelect(p.id, { replace: true }); closeSheet() }}
                  >
                    <span className="tnp2-avatar" style={{ background: pal.bg, color: pal.fg }}>{initialsFor(p.name)}</span>
                    <div className="tnp2-list-row-info">
                      <span className="tnp2-list-row-name">{p.name}</span>
                      <span className="tnp2-list-row-sub">{n} note{n === 1 ? '' : 's'}</span>
                    </div>
                    {current && <span className="tnp2-sheet-check" aria-label="Current patient"><CheckIcon /></span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TherapistNotesProgressPage({ user, onLogout, betaTier }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [basePatients, setPatients]  = useState([])
  const [cover,       setCover]       = useState({ out: [], inn: [], absent: false, need: 0 })
  const [hub, setHub] = useState(null) // the open share modal: { patient, note, tab, existing }
  const [flash,       setFlash]       = useState('')
  const [stopTarget,  setStopTarget]  = useState(null) // the share waiting for "Stop sharing?" confirmation
  const [stopping,    setStopping]    = useState(false)
  const [todayData,   setTodayData]   = useState(null) // today's sessions, loaded ahead so the share modal opens at once
  const [notes,       setNotes]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [view,        setView]        = useState('overview')  // 'overview' | 'new' | 'edit' | 'viewer'
  const [viewingId,   setViewingId]   = useState(null)
  const [editing,     setEditing]     = useState(null)        // a draft opened for editing
  const [locked,      setLocked]      = useState(null)        // { reason } while the page is locked
  const [reloadKey,   setReloadKey]   = useState(0)
  const versionRef = useRef({}) // latest server version of each draft saved on this page

  // Notes handed over by (or to) another therapist. Failures are ignored: the page works without them.
  const loadCover = useCallback(async () => {
    try {
      const [byMe, withMe] = await Promise.all([sharedByMe().catch(() => ({ shares: [] })), fetchSharedWithMe().catch(() => ({ shares: [] }))])
      setCover({ out: byMe.shares || [], inn: withMe.shares || [], absent: Boolean(byMe.absentToday), need: byMe.needCover || 0 })
    } catch { /* keep what we have */ }
  }, [])
  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 7000) }

  // The patient list: my own patients, plus (as "Shared with me") patients a colleague handed over. A handed-over
  // patient is never added to my permanent list: it exists here only while the share does.
  const patients = useMemo(() => {
    const latest = (rows) => { const m = new Map(); for (const sh of rows) if (!m.has(sh.patientId)) m.set(sh.patientId, sh); return m }
    const outBy = latest(cover.out.filter((sh) => sh.status !== 'revoked' && sh.status !== 'expired'))
    const inBy = latest(cover.inn)
    const own = new Set(basePatients.map((p) => p.id))
    const mine = basePatients.map((p) => ({ ...p, out: outBy.get(p.id) || null }))
    const extra = [...inBy.values()].filter((sh) => !own.has(sh.patientId)).map((sh) => ({ id: sh.patientId, name: sh.patientName || 'Patient', diagnosis: sh.diagnosis || 'No condition on file', cover: sh }))
    return [...mine, ...extra]
  }, [basePatients, cover])

  // Everything on this page comes from the secured API with the session
  // token. Note text lives only in React state — never in browser storage —
  // and is dropped the moment the page locks.
  const lockPage = useCallback((reason) => {
    setLocked({ reason })
    setNotes({})
    setViewingId(null)
    setEditing((e) => (e && view !== 'edit' ? null : e))
    setView((v) => (v === 'viewer' ? 'overview' : v))
  }, [view])
  const handleSessionError = useCallback((err) => {
    if (err.code === 'SESSION_LOCKED') lockPage('This page locked after 15 minutes of inactivity.')
    else setLoadError('Your session has ended. Please sign in again with your clinic account.')
  }, [lockPage])

  useIdleLock(!locked && !loading, () => lockPage('This page locked after 15 minutes of inactivity.'))

  useEffect(() => {
    if (locked) return undefined
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setLoadError('Your account isn’t linked to a staff record yet.')
      return undefined
    }
    setLoading(true)
    Promise.all([
      fetch(`/api/patients/therapist-list?email=${encodeURIComponent(user.email)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          return body.patients || []
        }),
      listNotes(),
    ])
      .then(([apiPatients, apiNotes]) => {
        if (cancelled) return
        setLoadError('')
        setPatients(apiPatients.map((p) => ({ id: p.id, name: p.name, diagnosis: p.condition || 'No condition on file' })))
        const grouped = {}
        for (const n of apiNotes) {
          if (!grouped[n.patientId]) grouped[n.patientId] = []
          grouped[n.patientId].push(fromApiNote(n))
        }
        setNotes(grouped)
      })
      .catch(async (e) => {
        if (cancelled) return
        // No connection: fall back to the patients saved on this device by the last sync.
        if (isNetworkError(e)) {
          const saved = await listDocs('patients').catch(() => [])
          if (cancelled) return
          if (saved.length) {
            setLoadError('')
            setPatients(saved.map((p) => ({ id: p._id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient', diagnosis: 'Saved on this device' })))
            setNotes({})
            return
          }
          setLoadError('No internet connection, and no patients are saved on this device yet. Open this page once while online first.')
          return
        }
        if (e.code === 'SESSION_LOCKED') lockPage('This page locked after 15 minutes of inactivity.')
        else if (e.code === 'NO_SESSION') setLoadError('Please sign in again with your clinic account to open session notes.')
        else setLoadError(e.message || 'Could not load notes.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email, reloadKey, locked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!locked) loadCover() }, [reloadKey, locked, loadCover])

  // The selected patient lives in the URL (?patient=<id>; ?patientId= is the
  // older link format). Desktop falls back to the first patient; phones start
  // on the list. The server never trusts this value: it re-checks assignment.
  const urlPatient = searchParams.get('patient') || searchParams.get('patientId')
  const selectedId = patients.some(p => p.id === urlPatient)
    ? urlPatient
    : (!isMobile && patients.length > 0 ? patients[0].id : null)
  const selectedPatient = patients.find(p => p.id === selectedId)

  // Back/forward (phone back gesture) changes the URL: drop any open note.
  useEffect(() => { setView('overview'); setViewingId(null); setEditing(null) }, [urlPatient])

  // On phones the notebook renders below the patient list, so bring it into view.
  const detailRef = useRef(null)
  useEffect(() => {
    if (view === 'overview') return
    if (typeof window !== 'undefined' && window.innerWidth <= 768) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [view, viewingId])

  const selectPatient = (id, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    next.set('patient', id)
    next.delete('patientId')
    setSearchParams(next, { replace: replace || !isMobile, state: replace ? location.state : { fromList: true } })
    setView('overview'); setViewingId(null); setEditing(null)
  }
  const backToList = () => {
    if (location.state?.fromList) { navigate(-1); return }
    const next = new URLSearchParams(searchParams)
    next.delete('patient'); next.delete('patientId')
    setSearchParams(next, { replace: true })
  }

  const openNote = (note) => { setViewingId(note.id); setView('viewer') }
  const startNew = () => { setView('new'); setViewingId(null); setEditing(null) }
  const startEditDraft = (noteOrMeta) => {
    // From the list we only have metadata; the viewer passes the full note.
    if (noteOrMeta.subjective !== undefined) { setEditing(noteOrMeta); setView('edit'); return }
    setViewingId(noteOrMeta.id); setView('viewer')
  }
  // ?draft=<noteId>: an auto-drafted home practice note opened from Assign Games. A draft opens in the notebook, a signed one in the viewer.
  const draftId = searchParams.get('draft')
  const [homeCtx, setHomeCtx] = useState(null)
  useEffect(() => {
    if (!draftId || loading || locked || loadError) return undefined
    let alive = true
    ;(async () => {
      try {
        const ctx = await authFetch('/api/therapist/home-sets/note-context', { query: { noteId: draftId } })
        if (!alive) return
        if (urlPatient !== ctx.patientId) { const n = new URLSearchParams(searchParams); n.set('patient', ctx.patientId); n.delete('patientId'); setSearchParams(n, { replace: true }); return } // the effect runs again with the right patient
        setHomeCtx(ctx)
        if (ctx.status === 'signed') { setViewingId(draftId); setView('viewer'); return }
        const note = await fetchNoteById(draftId)
        if (!alive) return
        versionRef.current[draftId] = note.version
        setEditing(note); setView('edit')
      } catch (err) {
        if (!alive) return
        if (handleSessionErrorOnce(err)) return
        showFlash('That home practice note could not be opened.')
        navigate('/therapist/assign-games?tab=home', { replace: true })
      }
    })()
    return () => { alive = false }
  }, [draftId, loading, locked, loadError, urlPatient]) // eslint-disable-line react-hooks/exhaustive-deps
  const leaveHomeNote = (to) => { const n = new URLSearchParams(searchParams); n.delete('draft'); setSearchParams(n, { replace: true }); setHomeCtx(null); if (to) navigate(to) }

  const reload = () => setReloadKey((k) => k + 1)
  const backToOverview = () => { setView('overview'); setViewingId(null); setEditing(null); reload() }

  const saveNote = async (form) => {
    const payload = {
      patientId: selectedId,
      sessionDate: manilaDateKey(),
      diagnosis: selectedPatient?.diagnosis,
      subjective: form.subjective, objective: form.objective, assessment: form.assessment, plan: form.plan,
      sign: form.sign, signatureImage: form.signatureData, password: form.password,
    }
    // An existing draft (opened for editing, or created while dictating) is updated or signed in place.
    const existingId = editing?.id || form.noteId
    // The server version this text was edited from. Sent with every save so a change made on
    // another device is detected instead of silently overwritten.
    const baseVersion = existingId ? (versionRef.current[existingId] ?? editing?.version) : undefined

    // Saves the draft on THIS device (encrypted) and queues it for the sync engine.
    // baseVersion = the server version this text was edited from (0 = brand-new note).
    const saveDraftLocally = async (local) => {
      const rec = await saveLocal('soapNotes', {
        _id: existingId || undefined,
        patient_id: selectedId, session_date: manilaDateKey(), diagnosis: selectedPatient?.diagnosis,
        subjective: form.subjective, objective: form.objective, assessment: form.assessment, plan: form.plan,
        baseVersion: local ? local.baseVersion : (existingId ? (baseVersion ?? 1) : 0),
      }, existingId ? 'update' : 'create')
      return rec._id
    }

    try {
      if (!form.sign) {
        // A draft that only exists on this device (not on the server yet) is always saved locally.
        const local = existingId ? await getDoc('soapNotes', existingId).catch(() => null) : null
        if (local && local.syncStatus !== 'synced') return await saveDraftLocally(local)
      }
      if (existingId) {
        if (form.sign) await signDraft(existingId, payload)
        else {
          const saved = await updateDraft(existingId, { ...payload, baseVersion })
          if (saved?.version) versionRef.current[existingId] = saved.version
        }
        return existingId
      }
      const created = await createNote(payload)
      versionRef.current[created.id] = created.version || 1
      return created.id
    } catch (err) {
      if (err.code === 'SESSION_LOCKED') lockPage('This page locked after 15 minutes of inactivity. Your text is still here.')
      // No connection: keep the draft on this device. Signing needs the password and the server, so it cannot go offline.
      if (!form.sign && isNetworkError(err)) return saveDraftLocally(null)
      if (form.sign && isNetworkError(err)) throw new Error('Signing needs an internet connection. Your draft is safe: save it, then sign once you are back online.')
      throw err
    }
  }

  // Dictation needs a saved note to attach its voice log to, so the first flush creates a draft.
  const ensureDraft = async (soapNow) => {
    try {
      const created = await createNote({
        patientId: selectedId, sessionDate: manilaDateKey(), diagnosis: selectedPatient?.diagnosis,
        subjective: soapNow.subjective, objective: soapNow.objective, assessment: soapNow.assessment, plan: soapNow.plan, sign: false,
      })
      return created.id
    } catch (err) {
      if (!isNetworkError(err)) throw err
      // Offline: create the draft on this device; it is sent when the connection returns.
      const rec = await saveLocal('soapNotes', {
        patient_id: selectedId, session_date: manilaDateKey(), diagnosis: selectedPatient?.diagnosis,
        subjective: soapNow.subjective, objective: soapNow.objective, assessment: soapNow.assessment, plan: soapNow.plan, baseVersion: 0,
      }, 'create')
      return rec._id
    }
  }

  // Reopens a draft that is saved on this device. Its version is the server version it was based on.
  const openLocalDraft = (d) => { setEditing({ id: d._id, version: d.baseVersion, subjective: d.subjective, objective: d.objective, assessment: d.assessment, plan: d.plan }); setView('edit') }

  // Opens the share modal at once: everything it needs (today's sessions, the colleague list) is loaded ahead.
  const latestSigned = (p) => (notes[p.id] || []).find((x) => x.signed && !x.voided) || null
  const openHub = (patient, note, tab, existing = null) => setHub({ patient, note, tab, existing })
  // Today's session for the patient, and the state of today's note, for the "Another therapist" tab.
  const hubSession = (() => {
    if (!hub) return null
    const sess = todayData?.sessions.find((x) => x.patientId === hub.patient.id)
    const ex = hub.existing
    if (!sess && !ex) return null
    const base = sess ? { id: sess.id, date: todayData.today, start: sess.start } : { id: ex.appointmentId, date: ex.sessionDate, start: ex.sessionStart }
    const todayNote = todayData ? (notes[hub.patient.id] || []).find((n) => n.rawDate === todayData.today && !n.voided) : null
    return { ...base, dateLabel: coverDay(base.date), noteId: ex?.noteId || todayNote?.id || null, noteStatus: todayNote ? todayNote.status : 'none' }
  })()
  const afterTherapistShare = (share, chosen) => {
    const first = chosen.name.split(' ')[0]
    showFlash(`${share.access === 'view' ? 'The note' : "Today's note"} for ${hub.patient.name} was shared with ${chosen.name}. ${first} can ${share.access === 'view' ? 'view' : 'write and sign'} it.`)
    setHub(null)
    loadCover(); reload()
  }
  const stopShare = (sh) => setStopTarget(sh)
  const confirmStop = async () => {
    setStopping(true)
    try { await stopCoverShare(stopTarget.id); showFlash('Sharing stopped.'); setStopTarget(null); loadCover(); reload() } catch (err) { setStopTarget(null); if (!handleSessionErrorOnce(err)) showFlash(err.message) } finally { setStopping(false) }
  }
  const coverUi = {
    meName: user?.name || 'You', onShare: (p) => openHub(p, latestSigned(p), 'therapist'), onChange: (p, sh) => openHub(p, null, 'therapist', sh), onStop: stopShare,
    onChanged: () => { loadCover(); reload() }, onRefresh: loadCover, onFlash: showFlash,
  }
  // Load today's sessions once (and when the list reloads), and warm the colleague list for the selected patient.
  useEffect(() => { if (!locked && !todayData) authFetch('/api/therapist/today').then(setTodayData).catch(() => {}) }, [locked]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sess = todayData?.sessions.find((x) => x.patientId === selectedId)
    if (sess) listAvailable(todayData.today, sess.start).catch(() => {})
  }, [todayData, selectedId])
  const incomingPending = cover.inn.find((sh) => sh.status === 'pending')
  const doShare = async (sections, summary, domain) => {
    await shareNote(hub.note.id, sections, summary, domain)
    setHub(null)
    reload()
  }
  const doUnshare = async (note) => {
    if (!window.confirm('Unshare this note? The guardian will no longer be able to read it.')) return
    try { await unshareNote(note.id); reload() } catch (err) { if (!handleSessionErrorOnce(err)) alert(err.message) }
  }
  const handleSessionErrorOnce = (err) => { if (err.code === 'SESSION_LOCKED' || err.code === 'NO_SESSION') { handleSessionError(err); return true } return false }

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Notes &amp; Progress"
      subtitle="Document session notes and track outcomes"
      icon="📝"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading your patients and notes…</p>
      ) : loadError ? (
        <div>
          <p role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>{loadError}</p>
          {loadError.includes('sign in again') && <button className="tnp-primary-btn" onClick={onLogout}>Go to sign in</button>}
        </div>
      ) : (
      <div className="tnp-page">
        {flash && <div className="cv-toast" role="status"><Share2 size={18} aria-hidden="true" /> {flash}</div>}
        {incomingPending && <IncomingBanner share={incomingPending} onOpen={() => selectPatient(incomingPending.patientId)} />}
        {cover.absent && cover.need > 0 && <AbsentBanner count={cover.need} onShare={() => { const p = selectedPatient && !selectedPatient.cover ? selectedPatient : basePatients[0]; if (p) openHub(p, latestSigned(p), 'therapist') }} />}
        {patients.length === 0 ? (
          <p className="tnp2-empty-notes">No patients yet — they'll show up here once they book with you.</p>
        ) : (
          // Stays mounted (just hidden) while a note is open so the filter,
          // search and "See more" count survive coming back.
          <div style={view === 'overview' ? undefined : { display: 'none' }}>
            <OfflineDrafts patientId={selectedId} onOpen={openLocalDraft} />
            <NotesShell
              patients={patients}
              notes={notes}
              selectedId={selectedId}
              onSelect={selectPatient}
              onBack={backToList}
              onNewNote={startNew}
              onViewNote={openNote}
              onEditDraft={startEditDraft}
              onShareNote={(n) => { const p = patients.find((x) => x.id === selectedId); if (p) openHub(p, n, 'guardian') }}
              onUnshare={doUnshare}
              isMobile={isMobile}
              coverUi={coverUi}
            />
          </div>
        )}

        {(view === 'new' || view === 'edit') && selectedPatient && (
          <div className="tnp-scroll-area" ref={detailRef}>
            <NoteForm key={editing?.id || 'new'} patient={selectedPatient} initial={view === 'edit' ? editing : null} onSave={saveNote} onEnsureDraft={ensureDraft} onCancel={() => { if (homeCtx) leaveHomeNote(); backToOverview() }} locked={!!locked} cover={selectedPatient.cover || null} meName={user?.name || ''}
              home={view === 'edit' && homeCtx && homeCtx.noteId === editing?.id ? homeCtx : null}
              onHomeBack={() => leaveHomeNote('/therapist/assign-games?tab=home')}
              onReviewNext={() => leaveHomeNote(`/therapist/assign-games?tab=home&review=${homeCtx?.setId}`)}
              onOpenSigned={(id) => { setHomeCtx((c) => (c ? { ...c, status: 'signed' } : c)); setViewingId(id); setView('viewer') }}
              refreshVersion={async (id) => { const n = await fetchNoteById(id); versionRef.current[id] = n.version }} />
          </div>
        )}

        {view === 'viewer' && viewingId && (
          <div className="tnp-scroll-area" ref={detailRef}>
            {homeCtx && homeCtx.noteId === viewingId && homeCtx.status === 'signed' && (
              <div className="hp-next" style={{ marginBottom: 12 }}><span><b>Home practice note signed.</b> The recommended Set {homeCtx.setNumber + 1} is unlocked.</span><span style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => leaveHomeNote('/therapist/assign-games?tab=home')}>← Back to Assign Games</button><button type="button" onClick={() => leaveHomeNote(`/therapist/assign-games?tab=home&review=${homeCtx.setId}`)}>Review next set →</button></span></div>
            )}
            <NoteViewerSecure
              noteId={viewingId}
              patient={selectedPatient}
              therapistName={user?.name}
              onBack={backToOverview}
              onEditDraft={startEditDraft}
              onChanged={reload}
              onSessionError={handleSessionError}
            />
          </div>
        )}
      </div>
      )}

      {stopTarget && <StopShareModal share={stopTarget} busy={stopping} onCancel={() => setStopTarget(null)} onConfirm={confirmStop} />}
      {hub && <ShareHub patient={hub.patient} guardianNote={hub.note && hub.note.signed ? hub.note : null} session={hubSession} existing={hub.existing} initialTab={hub.tab} onGuardianShare={doShare} onTherapistDone={afterTherapistShare} onClose={() => setHub(null)} />}
      {locked && <LockScreen reason={locked.reason} userName={user?.name} onUnlocked={() => setLocked(null)} onSignOut={onLogout} />}
    </TherapistPageShell>
  )
}
