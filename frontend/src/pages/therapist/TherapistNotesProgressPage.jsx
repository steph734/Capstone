import { useState, useRef, useEffect } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { useSharedProgress } from '../../context/ProgressContext'
import { manilaDateKey } from '../../utils/manilaTime'
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

// therapy_notes doc (see api/_lib/routes/notes-therapist-list.js) -> the
// shape NoteForm/NoteViewer/NotesShell already expect.
function fromApiNote(n) {
  return {
    id: n.id,
    date: fmtNoteDate(n.date),
    shortDate: fmtNoteDateShort(n.date),
    subjective: n.subjective || '',
    objective: n.objective || '',
    assessment: n.assessment || '',
    plan: n.plan || '',
    signatureData: n.signatureImage || null,
    signed: n.status === 'signed',
    shareable: !!n.sharedWithGuardian,
    domain: n.domain || DOMAINS[0],
    parentSummary: n.sharedSummary || '',
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
function NoteForm({ patient, onSave, onCancel }) {
  const today      = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const todayShort = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const [soap,    setSoap]    = useState({ subjective: '', objective: '', assessment: '', plan: '' })
  const [sigData, setSigData] = useState(null)
  const [saved,   setSaved]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [shareWithParent, setShareWithParent] = useState(false)
  const [parentSummary,   setParentSummary]   = useState('')
  const [domain,          setDomain]          = useState(DOMAINS[0])

  const set = (field) => (e) => setSoap(prev => ({ ...prev, [field]: e.target.value }))
  const allFilled = soap.subjective.trim() && soap.objective.trim() && soap.assessment.trim() && soap.plan.trim()
  const shareReady = !shareWithParent || parentSummary.trim()

  const handleSave = async () => {
    if (!allFilled)  { alert('Please fill in all SOAP fields before saving.'); return }
    if (!sigData)    { alert('Please sign the note before saving.'); return }
    if (!shareReady) { alert('Please add a parent-friendly summary before sharing this note.'); return }
    setSaving(true)
    try {
      await onSave({
        ...soap, signatureData: sigData, signed: true,
        shareable: shareWithParent, domain, parentSummary: shareWithParent ? parentSummary.trim() : '',
      })
      setSaved(true)
    } catch (err) {
      alert(err.message || 'Could not save this note. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="tnp-saved-state">
        <div className="tnp-saved-icon">✅</div>
        <h3>Note Saved &amp; Signed!</h3>
        <p>Session note for <strong>{patient.name}</strong> has been signed and saved successfully.</p>
        <button className="tnp-primary-btn" onClick={onCancel}>Back to Patient</button>
      </div>
    )
  }

  return (
    <div className="tnp-notebook">
      <div className="tnp-spiral" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => <div key={i} className="tnp-ring" />)}
      </div>

      <div className="tnp-paper">
        <div className="tnp-deco-tr">📋</div>

        <div className="tnp-title-row">
          <h2 className="tnp-title">Session Note</h2>
          <div className="tnp-date-box">
            <span className="tnp-field-label">📅 Date:</span>
            <span className="tnp-field-val tnp-field-line">{today}</span>
          </div>
        </div>

        <div className="tnp-field-row">
          <span className="tnp-field-label">👤 Patient:</span>
          <span className="tnp-field-val tnp-field-line">{patient.name}</span>
        </div>
        <div className="tnp-field-row tnp-field-row-last">
          <span className="tnp-field-label">🩺 Diagnosis:</span>
          <span className="tnp-field-val tnp-field-line">{patient.diagnosis}</span>
        </div>

        <div className="tnp-rule" />

        {[
          { key: 'subjective', label: '💬 Subjective', hint: 'What the patient reported or felt...', cls: 'tnp-s' },
          { key: 'objective',  label: '👀 Objective',  hint: 'Measured outcomes, ROM, accuracy...', cls: 'tnp-o' },
          { key: 'assessment', label: '📊 Assessment', hint: 'Clinical interpretation of findings...', cls: 'tnp-a' },
          { key: 'plan',       label: '🌟 Plan',       hint: 'Next steps and home program...', cls: 'tnp-p' },
        ].map(({ key, label, hint, cls }) => (
          <div key={key} className="tnp-section">
            <div className={`tnp-section-label ${cls}`}>{label}</div>
            <textarea
              className="tnp-textarea"
              placeholder={hint}
              value={soap[key]}
              onChange={set(key)}
              rows={3}
            />
          </div>
        ))}

        <div className="tnp-share-section">
          <label className="tnp-share-toggle">
            <input
              type="checkbox"
              checked={shareWithParent}
              onChange={(e) => setShareWithParent(e.target.checked)}
            />
            <span>🏡 Share a parent-friendly summary of this note</span>
          </label>
          {shareWithParent && (
            <div className="tnp-share-fields">
              <div className="tnp-share-field">
                <label>Domain</label>
                <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                  {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="tnp-share-field tnp-share-field-full">
                <label>Parent-friendly summary (no clinical jargon)</label>
                <textarea
                  className="tnp-textarea"
                  placeholder='e.g. "Getting better at focus games this week!"'
                  value={parentSummary}
                  onChange={(e) => setParentSummary(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        <div className="tnp-sig-section">
          <div className="tnp-sig-title">✍️ Therapist Signature</div>
          <p className="tnp-sig-desc">Draw your signature below to certify this session note.</p>
          <SignaturePad onSign={setSigData} onClear={() => setSigData(null)} />
        </div>

        <div className="tnp-form-footer">
          <button className="tnp-ghost-btn" onClick={onCancel} type="button">Cancel</button>
          <button
            className={`tnp-primary-btn${(saving || !allFilled || !sigData || !shareReady) ? ' tnp-btn-dim' : ''}`}
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? 'Saving…' : '💾 Save & Sign Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Note Viewer (read-only) ───────────────────────────────────────────────────
function NoteViewer({ note, patient, onBack }) {
  return (
    <div className="tnp-notebook">
      <div className="tnp-spiral" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => <div key={i} className="tnp-ring" />)}
      </div>

      <div className="tnp-paper">
        <div className="tnp-deco-tr">📋</div>

        <div className="tnp-title-row">
          <h2 className="tnp-title">Session Note</h2>
          <div className="tnp-date-box">
            <span className="tnp-field-label">📅 Date:</span>
            <span className="tnp-field-val tnp-field-line">{note.date}</span>
          </div>
        </div>

        <div className="tnp-field-row">
          <span className="tnp-field-label">👤 Patient:</span>
          <span className="tnp-field-val tnp-field-line">{patient.name}</span>
        </div>
        <div className="tnp-field-row tnp-field-row-last">
          <span className="tnp-field-label">🩺 Diagnosis:</span>
          <span className="tnp-field-val tnp-field-line">{patient.diagnosis}</span>
        </div>

        <div className="tnp-rule" />

        {[
          { key: 'subjective', label: '💬 Subjective', cls: 'tnp-s' },
          { key: 'objective',  label: '👀 Objective',  cls: 'tnp-o' },
          { key: 'assessment', label: '📊 Assessment', cls: 'tnp-a' },
          { key: 'plan',       label: '🌟 Plan',       cls: 'tnp-p' },
        ].map(({ key, label, cls }) => (
          <div key={key} className="tnp-section">
            <div className={`tnp-section-label ${cls}`}>{label}</div>
            <div className="tnp-view-body">{note[key]}</div>
          </div>
        ))}

        <div className="tnp-sig-section">
          <div className="tnp-sig-row">
            <span className="tnp-sig-cheer">✨ Great session!</span>
            <div className="tnp-sig-right">
              {note.signatureData
                ? <img src={note.signatureData} alt="Therapist signature" className="tnp-sig-img" />
                : <div className="tnp-sig-placeholder-line" />
              }
              <span className="tnp-sig-text">Therapist Signature</span>
            </div>
          </div>
        </div>

        <div className="tnp-form-footer">
          <button className="tnp-ghost-btn" onClick={onBack}>← Back</button>
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

function NotesShell({ patients, notes, selectedId, onSelect, onNewNote, onViewNote, onToggleShare }) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

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

  return (
    <div className="tnp2-shell">
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
            <button key={f} className={`tnp2-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
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
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Two-pane split */}
      <div className="tnp2-split">
        <div className="tnp2-list-pane">
          {filteredPatients.length === 0 ? (
            <p className="tnp2-list-empty">No patients match.</p>
          ) : filteredPatients.map(p => {
            const pNotes = notes[p.id] || []
            const status = statusFor(p)
            const pal = paletteFor(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`tnp2-list-row${selectedId === p.id ? ' active' : ''}`}
                onClick={() => onSelect(p.id)}
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
              </button>
            )
          })}
        </div>

        <div className="tnp2-detail-pane">
          {!selectedPatient ? (
            <div className="tnp2-detail-empty">Select a patient to see their notes.</div>
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

              {patientNotes.length === 0 ? (
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
                          {n.signed && <CheckCircleIcon />} {n.signed ? 'Signed' : 'Draft'}
                        </span>
                        <span className={n.shareable ? 'tnp-shared-pill' : 'tnp2-private-pill'}>
                          {n.shareable && <HomeIcon />} {n.shareable ? 'Shared' : 'Private'}
                        </span>
                      </div>
                      <p className="tnp2-note-preview"><strong>O</strong> · {n.objective ? `${n.objective.slice(0, 90)}…` : '—'}</p>
                      <p className="tnp2-note-preview"><strong>P</strong> · {n.plan ? `${n.plan.slice(0, 90)}…` : '—'}</p>
                      <div className="tnp2-note-actions">
                        <button className="tnp-table-view-btn" onClick={() => onViewNote(n)}>View</button>
                        <button className="tnp2-share-btn" onClick={() => onToggleShare(n)}>
                          {n.shareable ? 'Unshare' : 'Share'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TherapistNotesProgressPage({ user, onLogout, betaTier }) {
  const [patients,    setPatients]    = useState([])
  const [notes,       setNotes]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [selectedId,  setSelectedId]  = useState(null)
  const [view,        setView]        = useState('overview')  // 'overview' | 'new' | 'viewer'
  const [viewingNote, setViewingNote] = useState(null)
  const { shareNote, unshareNote } = useSharedProgress()

  // Every patient who has actually booked with this therapist (see
  // api/_lib/routes/patients-therapist-list.js) plus every signed session
  // note they've written for those patients (api/_lib/routes/notes-*.js),
  // straight from the `therapy_notes` collection — replacing the old
  // hardcoded demo roster/notes.
  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setLoadError('Your account isn’t linked to a staff record yet.')
      return
    }
    setLoading(true)
    Promise.all([
      fetch(`/api/patients/therapist-list?email=${encodeURIComponent(user.email)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          return body.patients || []
        }),
      fetch(`/api/notes/therapist-list?email=${encodeURIComponent(user.email)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          return body.notes || []
        }),
    ])
      .then(([apiPatients, apiNotes]) => {
        if (cancelled) return
        setPatients(apiPatients.map((p) => ({
          id: p.id,
          name: p.name,
          diagnosis: p.condition || 'No condition on file',
        })))
        const grouped = {}
        for (const n of apiNotes) {
          if (!grouped[n.patientId]) grouped[n.patientId] = []
          grouped[n.patientId].push(fromApiNote(n))
        }
        setNotes(grouped)
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load notes.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email])

  const selectedPatient = patients.find(p => p.id === selectedId)

  // The two-pane overview always shows a patient's notes on the right, so
  // default to the first one once the roster loads rather than starting on
  // an empty "select a patient" state.
  useEffect(() => {
    if (!loading && selectedId === null && patients.length > 0) {
      setSelectedId(patients[0].id)
    }
  }, [loading, patients, selectedId])

  // On phones the notebook (new/viewer) renders below the patient list, so
  // opening it would otherwise look like nothing happened — bring it into
  // view once it mounts / changes.
  const detailRef = useRef(null)
  useEffect(() => {
    if (view === 'overview') return
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [view, viewingNote])

  const selectPatient = (id) => { setSelectedId(id); setView('overview'); setViewingNote(null) }
  const openNote  = (note) => { setViewingNote(note); setView('viewer') }
  const startNew  = ()     => { setView('new'); setViewingNote(null) }

  const saveNote = async (formNote) => {
    const sessionDate = manilaDateKey()
    const res = await fetch('/api/notes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: selectedId,
        patientName: selectedPatient?.name,
        diagnosis: selectedPatient?.diagnosis,
        employeeEmail: user?.email,
        sessionDate,
        subjective: formNote.subjective,
        objective: formNote.objective,
        assessment: formNote.assessment,
        plan: formNote.plan,
        signatureImage: formNote.signatureData,
        domain: formNote.domain,
        shareWithGuardian: formNote.shareable,
        parentSummary: formNote.parentSummary,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)

    const note = {
      id: body.id,
      date: fmtNoteDate(sessionDate),
      shortDate: fmtNoteDateShort(sessionDate),
      subjective: formNote.subjective,
      objective: formNote.objective,
      assessment: formNote.assessment,
      plan: formNote.plan,
      signatureData: formNote.signatureData,
      signed: true,
      shareable: formNote.shareable,
      domain: formNote.domain,
      parentSummary: formNote.parentSummary,
    }
    setNotes(prev => ({ ...prev, [selectedId]: [note, ...(prev[selectedId] || [])] }))

    // Alvrin is the shared demo patient wired to the parent-facing Progress
    // page via ProgressContext — matched by name since real patient ids are
    // now Mongo ObjectId strings, not the old fixed demo index.
    if (selectedPatient?.name === 'Alvrin' && note.shareable) {
      shareNote({ id: `sn-${note.id}`, date: note.date, domain: note.domain, summary: note.parentSummary })
    }
    logActivity({
      role: 'Therapist',
      user: user?.name || 'Therapist',
      email: user?.email || '—',
      actionIcon: '📝',
      action: 'Patient Notes',
      description: `Added a signed SOAP note for ${selectedPatient?.name || 'a patient'}`,
      entity: `Patient #${selectedId}`,
      status: 'Success',
    })
  }

  const toggleShare = async (note) => {
    const nextShareable = !note.shareable
    const domain = note.domain || DOMAINS[0]
    const summary = note.parentSummary || note.assessment
    try {
      const res = await fetch(`/api/notes/${note.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: nextShareable, domain, summary }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
    } catch (err) {
      alert(err.message || 'Could not update sharing for this note.')
      return
    }

    setNotes(prev => ({
      ...prev,
      [selectedId]: prev[selectedId].map(n => (
        n.id === note.id
          ? { ...n, shareable: nextShareable, domain, parentSummary: nextShareable ? summary : n.parentSummary }
          : n
      )),
    }))
    if (selectedPatient?.name === 'Alvrin') {
      if (nextShareable) shareNote({ id: `sn-${note.id}`, date: note.date, domain, summary })
      else unshareNote(`sn-${note.id}`)
    }
  }

  const backToOverview = () => { setView('overview'); setViewingNote(null) }

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
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{loadError}</p>
      ) : (
      <div className="tnp-page">
        {view === 'overview' && (
          patients.length === 0 ? (
            <p className="tnp2-empty-notes">No patients yet — they'll show up here once they book with you.</p>
          ) : (
            <NotesShell
              patients={patients}
              notes={notes}
              selectedId={selectedId}
              onSelect={selectPatient}
              onNewNote={startNew}
              onViewNote={openNote}
              onToggleShare={toggleShare}
            />
          )
        )}

        {view === 'new' && (
          <div className="tnp-scroll-area" ref={detailRef}>
            <NoteForm patient={selectedPatient} onSave={saveNote} onCancel={backToOverview} />
          </div>
        )}

        {view === 'viewer' && viewingNote && (
          <div className="tnp-scroll-area" ref={detailRef}>
            <NoteViewer note={viewingNote} patient={selectedPatient} onBack={backToOverview} />
          </div>
        )}
      </div>
      )}
    </TherapistPageShell>
  )
}
