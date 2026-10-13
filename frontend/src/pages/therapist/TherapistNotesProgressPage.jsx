import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { manilaDateKey } from '../../utils/manilaTime'
import NoteViewerSecure from './notes/NoteViewerSecure'
import ShareDialog from './notes/ShareDialog'
import LockScreen, { useIdleLock } from './notes/IdleLock'
import { listNotes, createNote, updateDraft, signDraft, shareNote, unshareNote } from './notes/notesApi'
import { unescapeHtml } from '../../utils/session'
import './TherapistNotesProgressPage.css'

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
    shortDate: fmtNoteDateShort(n.date),
    status: n.status,
    voided: !!n.voided,
    signed: n.status === 'signed' && !n.voided,
    shareable: !!n.shared,
    sharedSections: n.sharedSections || [],
    addendaCount: n.addendaCount || 0,
    domain: n.domain || DOMAINS[0],
  }
}

// ── Signature Pad ─────────────────────────────────────────────────────────────
function SignaturePad({ onSign, onClear }) {
  const canvasRef  = useRef(null)
  const drawing    = useRef(false)
  const lastPos    = useRef({ x: 0, y: 0 })
  const [isEmpty,   setIsEmpty]   = useState(true)
  const [confirmed, setConfirmed] = useState(false)

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const src    = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    if (confirmed) return
    drawing.current  = true
    lastPos.current  = getPos(e)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!drawing.current || confirmed) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
    lastPos.current = pos
    setIsEmpty(false)
  }

  const endDraw = () => { drawing.current = false }

  const clearPad = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    setConfirmed(false)
    onClear()
  }

  const confirmSig = () => {
    if (isEmpty) return
    setConfirmed(true)
    onSign(canvasRef.current.toDataURL())
  }

  return (
    <div className="tnp-sigpad-wrap">
      <canvas
        ref={canvasRef}
        width={600}
        height={110}
        className={`tnp-canvas${confirmed ? ' tnp-canvas-confirmed' : ''}`}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!confirmed ? (
        <div className="tnp-sig-btns">
          <button className="tnp-ghost-btn" onClick={clearPad} type="button">Clear</button>
          <button
            className={`tnp-confirm-btn${isEmpty ? ' tnp-btn-dim' : ''}`}
            onClick={confirmSig}
            disabled={isEmpty}
            type="button"
          >
            ✅ Confirm Signature
          </button>
        </div>
      ) : (
        <div className="tnp-sig-confirmed-row">
          <span className="tnp-sig-confirmed-label">✅ Signature confirmed</span>
          <button className="tnp-ghost-btn" onClick={clearPad} type="button">Re-sign</button>
        </div>
      )}
    </div>
  )
}

// ── Note Form ─────────────────────────────────────────────────────────────────
// Four SOAP sections (10–5000 characters each to sign). Signing needs a drawn
// signature AND the password typed again; "Save draft" needs neither. The
// server re-validates everything and encrypts the text before it is stored.
const SOAP_SECTIONS = [
  { key: 'subjective', label: '💬 Subjective', hint: 'What the patient or guardian reported or felt...', cls: 'tnp-s' },
  { key: 'objective', label: '👀 Objective', hint: 'Measured outcomes, ROM, accuracy...', cls: 'tnp-o' },
  { key: 'assessment', label: '📊 Assessment', hint: 'Clinical interpretation of findings...', cls: 'tnp-a' },
  { key: 'plan', label: '🌟 Plan', hint: 'Next steps and home program...', cls: 'tnp-p' },
]
const fieldErrStyle = { color: '#b91c1c', fontSize: 12, display: 'block', marginTop: 4 }

function NoteForm({ patient, initial, onSave, onCancel }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const [soap, setSoap] = useState(() => Object.fromEntries(SOAP_SECTIONS.map(({ key }) => [key, unescapeHtml(initial?.[key] || '')])))
  const [sigData, setSigData] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState(null) // 'signed' | 'draft'
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const set = (field) => (e) => { setSoap((prev) => ({ ...prev, [field]: e.target.value })); setErrors((x) => ({ ...x, [field]: '' })) }

  const submit = async (sign) => {
    const e = {}
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
      await onSave({ ...soap, sign, signatureData: sigData, password })
      setPassword('')
      setDone(sign ? 'signed' : 'draft')
    } catch (err) {
      setErrors(err.fields || {})
      setFormError(err.message || 'Could not save this note.')
      setPassword('')
    } finally { setBusy('') }
  }

  if (done) {
    return (
      <div className="tnp-saved-state">
        <div className="tnp-saved-icon">{done === 'signed' ? '✅' : '📝'}</div>
        <h3>{done === 'signed' ? 'Note signed & saved' : 'Draft saved'}</h3>
        <p>{done === 'signed' ? 'It is now read-only. Corrections can only be added as addenda.' : 'You can keep editing it until you sign.'} For <strong>{patient.name}</strong>.</p>
        <button className="tnp-primary-btn" onClick={onCancel}>Back to Patient</button>
      </div>
    )
  }

  return (
    <div className="tnp-notebook">
      <div className="tnp-spiral" aria-hidden="true">{Array.from({ length: 14 }).map((_, i) => <div key={i} className="tnp-ring" />)}</div>
      <div className="tnp-paper">
        <div className="tnp-deco-tr">📋</div>
        <div className="tnp-title-row">
          <h2 className="tnp-title">{initial ? 'Edit Draft' : 'Session Note'}</h2>
          <div className="tnp-date-box"><span className="tnp-field-label">📅 Date:</span><span className="tnp-field-val tnp-field-line">{today}</span></div>
        </div>
        <div className="tnp-field-row"><span className="tnp-field-label">👤 Patient:</span><span className="tnp-field-val tnp-field-line">{patient.name}</span></div>
        <div className="tnp-field-row tnp-field-row-last"><span className="tnp-field-label">🩺 Diagnosis:</span><span className="tnp-field-val tnp-field-line">{patient.diagnosis}</span></div>
        <div className="tnp-rule" />

        {SOAP_SECTIONS.map(({ key, label, hint, cls }) => (
          <div key={key} className="tnp-section">
            <div className={`tnp-section-label ${cls}`}>{label}</div>
            <textarea className="tnp-textarea" placeholder={hint} value={soap[key]} onChange={set(key)} rows={3} maxLength={5000} aria-invalid={!!errors[key]} aria-label={label} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#6b7c75' }}>
              <span>{errors[key] && <span role="alert" style={fieldErrStyle}>{errors[key]}</span>}</span>
              <span>{soap[key].length} / 5000</span>
            </div>
          </div>
        ))}

        <div className="tnp-sig-section">
          <div className="tnp-sig-title">✍️ Therapist Signature</div>
          <p className="tnp-sig-desc">Draw your signature, then re-enter your password to certify and lock this note.</p>
          <SignaturePad onSign={(d) => { setSigData(d); setErrors((x) => ({ ...x, signature: '' })) }} onClear={() => setSigData(null)} />
          {errors.signature && <span role="alert" style={fieldErrStyle}>{errors.signature}</span>}
          <label className="tnp-field-label" htmlFor="sign-pw" style={{ display: 'block', marginTop: 12 }}>🔑 Password</label>
          <input id="sign-pw" type="password" autoComplete="current-password" className="tnp-textarea" style={{ minHeight: 42 }} value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })) }} />
          {errors.password && <span role="alert" style={fieldErrStyle}>{errors.password}</span>}
        </div>

        {formError && <p role="alert" style={{ ...fieldErrStyle, fontSize: 13 }}>{formError}</p>}
        <div className="tnp-form-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="tnp-ghost-btn" onClick={onCancel} type="button">Cancel</button>
          <button className="tnp-ghost-btn" onClick={() => submit(false)} disabled={!!busy} type="button">{busy === 'draft' ? 'Saving…' : '📝 Save draft'}</button>
          <button className="tnp-primary-btn" onClick={() => submit(true)} disabled={!!busy} type="button">{busy === 'sign' ? 'Signing…' : '💾 Sign & lock note'}</button>
        </div>
      </div>
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

function NotesShell({ patients, notes, selectedId, onSelect, onBack, onNewNote, onViewNote, onEditDraft, onShareNote, onUnshare, isMobile }) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSearch, setSheetSearch] = useState('')
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

  const counts = {
    All: patients.length,
    'Needs signing': patients.filter(p => statusFor(p) === 'Draft').length,
    Signed: patients.filter(p => statusFor(p) === 'Signed').length,
    'No notes': patients.filter(p => statusFor(p) === 'No notes').length,
  }

  const filteredPatients = patients.filter(p => {
    const status = statusFor(p)
    const matchFilter =
      filter === 'All' ? true :
      filter === 'Needs signing' ? status === 'Draft' :
      filter === 'Signed' ? status === 'Signed' :
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
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="tnp2-shell" ref={rootRef}>
      {showList && (<>
      {/* KPI cards */}
      <div className="tnp2-kpi-grid">
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
          {PATIENT_FILTERS.map(f => (
            <button key={f} className={`tnp2-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => changeFilter(f)}>
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
                    <span className={statusPillClass(status)}>{status}</span>
                  </div>
                  <span className="tnp2-list-row-sub">{p.diagnosis} · {pNotes.length} note{pNotes.length === 1 ? '' : 's'}</span>
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
              <button type="button" className="tnp2-new-note-btn tnp2-new-note-primary" onClick={onNewNote}>+ New session note</button>
              <div className="tnp2-m-label">Session notes</div>
              {notesBlock}
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
                <button className="tnp2-new-note-btn" onClick={onNewNote}>+ New session note</button>
              </div>
              {notesBlock}
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
  const [patients,    setPatients]    = useState([])
  const [notes,       setNotes]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [view,        setView]        = useState('overview')  // 'overview' | 'new' | 'edit' | 'viewer'
  const [viewingId,   setViewingId]   = useState(null)
  const [editing,     setEditing]     = useState(null)        // a draft opened for editing
  const [shareTarget, setShareTarget] = useState(null)
  const [locked,      setLocked]      = useState(null)        // { reason } while the page is locked
  const [reloadKey,   setReloadKey]   = useState(0)

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
      .catch((e) => {
        if (cancelled) return
        if (e.code === 'SESSION_LOCKED') lockPage('This page locked after 15 minutes of inactivity.')
        else if (e.code === 'NO_SESSION') setLoadError('Please sign in again with your clinic account to open session notes.')
        else setLoadError(e.message || 'Could not load notes.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email, reloadKey, locked]) // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      if (editing) {
        if (form.sign) await signDraft(editing.id, payload)
        else await updateDraft(editing.id, payload)
      } else {
        await createNote(payload)
      }
    } catch (err) {
      if (err.code === 'SESSION_LOCKED') lockPage('This page locked after 15 minutes of inactivity. Your text is still here.')
      throw err
    }
  }

  const doShare = async (sections, summary, domain) => {
    await shareNote(shareTarget.id, sections, summary, domain)
    setShareTarget(null)
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
        {patients.length === 0 ? (
          <p className="tnp2-empty-notes">No patients yet — they'll show up here once they book with you.</p>
        ) : (
          // Stays mounted (just hidden) while a note is open so the filter,
          // search and "See more" count survive coming back.
          <div style={view === 'overview' ? undefined : { display: 'none' }}>
            <NotesShell
              patients={patients}
              notes={notes}
              selectedId={selectedId}
              onSelect={selectPatient}
              onBack={backToList}
              onNewNote={startNew}
              onViewNote={openNote}
              onEditDraft={startEditDraft}
              onShareNote={setShareTarget}
              onUnshare={doUnshare}
              isMobile={isMobile}
            />
          </div>
        )}

        {(view === 'new' || view === 'edit') && selectedPatient && (
          <div className="tnp-scroll-area" ref={detailRef}>
            <NoteForm patient={selectedPatient} initial={view === 'edit' ? editing : null} onSave={saveNote} onCancel={backToOverview} />
          </div>
        )}

        {view === 'viewer' && viewingId && (
          <div className="tnp-scroll-area" ref={detailRef}>
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

      {shareTarget && <ShareDialog note={shareTarget} onShare={doShare} onClose={() => setShareTarget(null)} />}
      {locked && <LockScreen reason={locked.reason} userName={user?.name} onUnlocked={() => setLocked(null)} onSignOut={onLogout} />}
    </TherapistPageShell>
  )
}
