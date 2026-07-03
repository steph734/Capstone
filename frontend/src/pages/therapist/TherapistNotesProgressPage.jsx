import { useState, useRef } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import './TherapistNotesProgressPage.css'

const PATIENTS = [
  { id: 1, name: 'Aira Lopez',  diagnosis: 'Speech delay — expressive language', avatar: '/patients/images%20(8).jpg' },
  { id: 2, name: 'Mika Santos', diagnosis: 'Articulation disorder',               avatar: '/patients/images%20(9).jpg' },
  { id: 3, name: 'Noah Cruz',   diagnosis: 'Developmental delay — F82',           avatar: '/patients/images%20(7).jpg' },
]

const INITIAL_NOTES = {
  1: [{
    id: 'n1a', date: 'Jun 30, 2026', shortDate: 'Jun 30',
    subjective: 'Patient reports feeling more energetic this week. Completed all assigned home exercises. States "I feel stronger now." Parents confirm daily compliance and improved mood.',
    objective:  'ROM improved by 15%. Left-hand grasp maintained for 3 seconds consistently. Single-leg balance: 8 seconds (up from 6). Fine motor task accuracy: 72%.',
    assessment: 'Patient is progressing well. Motor skills showing measurable improvement across all domains. Motivation is high. No adverse effects noted.',
    plan:       'Continue current exercise regimen. Add fine motor bead-threading activity. Schedule follow-up in 2 weeks. Monitor fatigue levels during sessions.',
    signatureData: null, signed: true,
  }],
  2: [{
    id: 'n2a', date: 'Jun 23, 2026', shortDate: 'Jun 23',
    subjective: 'Some difficulty noted with wrist extension exercises. Patient fatigued easily during session.',
    objective:  'Coin sorting task completed in 45 sec (down from 62 sec). Grip strength: 10 kg. Fine motor accuracy: 65%.',
    assessment: 'Moderate improvement. Fatigue may be affecting performance output. Motivation remains positive.',
    plan:       'Reduce wrist extension sets temporarily. Monitor fatigue levels. Home program: 10 min daily fine motor tasks.',
    signatureData: null, signed: true,
  }],
  3: [],
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

  const set = (field) => (e) => setSoap(prev => ({ ...prev, [field]: e.target.value }))
  const allFilled = soap.subjective.trim() && soap.objective.trim() && soap.assessment.trim() && soap.plan.trim()

  const handleSave = () => {
    if (!allFilled) { alert('Please fill in all SOAP fields before saving.'); return }
    if (!sigData)   { alert('Please sign the note before saving.'); return }
    onSave({ id: `n${Date.now()}`, date: today, shortDate: todayShort, ...soap, signatureData: sigData, signed: true })
    setSaved(true)
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

        <div className="tnp-sig-section">
          <div className="tnp-sig-title">✍️ Therapist Signature</div>
          <p className="tnp-sig-desc">Draw your signature below to certify this session note.</p>
          <SignaturePad onSign={setSigData} onClear={() => setSigData(null)} />
        </div>

        <div className="tnp-form-footer">
          <button className="tnp-ghost-btn" onClick={onCancel} type="button">Cancel</button>
          <button
            className={`tnp-primary-btn${(!allFilled || !sigData) ? ' tnp-btn-dim' : ''}`}
            onClick={handleSave}
            type="button"
          >
            💾 Save &amp; Sign Note
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

// ── Patient Overview ──────────────────────────────────────────────────────────
function PatientOverview({ patient, notes, onNewNote, onViewNote }) {
  return (
    <div className="tnp-overview">
      <div className="tnp-overview-header">
        <img className="tnp-overview-avatar" src={patient.avatar} alt={patient.name} />
        <div className="tnp-overview-meta">
          <h2 className="tnp-overview-name">{patient.name}</h2>
          <p className="tnp-overview-diag">{patient.diagnosis}</p>
        </div>
      </div>

      <button className="tnp-new-note-btn" onClick={onNewNote}>
        + New Session Note
      </button>

      {notes.length === 0 ? (
        <div className="tnp-no-notes">
          <p>📋 No session notes yet for this patient.</p>
        </div>
      ) : (
        <div className="tnp-notes-grid">
          {notes.map(n => (
            <button key={n.id} className="tnp-note-card" onClick={() => onViewNote(n)}>
              <div className="tnp-note-card-date">{n.date}</div>
              <div className="tnp-note-card-preview">{n.subjective?.slice(0, 90)}…</div>
              {n.signed && <div className="tnp-note-card-signed">✅ Signed</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TherapistNotesProgressPage({ user, onLogout, betaTier }) {
  const [notes,       setNotes]       = useState(INITIAL_NOTES)
  const [selectedId,  setSelectedId]  = useState(null)
  const [view,        setView]        = useState('empty')  // 'empty' | 'overview' | 'new' | 'viewer'
  const [viewingNote, setViewingNote] = useState(null)

  const selectedPatient = PATIENTS.find(p => p.id === selectedId)
  const patientNotes    = selectedId ? (notes[selectedId] || []) : []

  const selectPatient = (id) => {
    setSelectedId(id)
    setView('overview')
    setViewingNote(null)
  }

  const openNote  = (note) => { setViewingNote(note); setView('viewer') }
  const startNew  = ()     => { setView('new'); setViewingNote(null) }

  const saveNote = (note) => {
    setNotes(prev => ({ ...prev, [selectedId]: [note, ...(prev[selectedId] || [])] }))
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
      <div className="tnp-shell">

        {/* ── LEFT: Patient list ── */}
        <div className="tnp-left">
          <div className="tnp-left-header">My Patients</div>
          <div className="tnp-patient-list">
            {PATIENTS.map(p => (
              <div key={p.id}>
                <button
                  className={`tnp-patient-row${selectedId === p.id ? ' tnp-patient-active' : ''}`}
                  onClick={() => selectPatient(p.id)}
                >
                  <img className="tnp-patient-avatar" src={p.avatar} alt={p.name} />
                  <div className="tnp-patient-info">
                    <div className="tnp-patient-name">{p.name}</div>
                    <div className="tnp-patient-count">{notes[p.id]?.length || 0} notes</div>
                  </div>
                </button>

                {/* Sub-list of past notes */}
                {selectedId === p.id && patientNotes.length > 0 && (
                  <div className="tnp-sub-notes">
                    {patientNotes.map(n => (
                      <button
                        key={n.id}
                        className={`tnp-sub-row${viewingNote?.id === n.id ? ' tnp-sub-active' : ''}`}
                        onClick={() => openNote(n)}
                      >
                        <span className="tnp-sub-date">{n.shortDate}</span>
                        <span className="tnp-sub-preview">{n.subjective?.slice(0, 30)}…</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Content ── */}
        <div className="tnp-right">
          {view === 'empty' && (
            <div className="tnp-empty">
              <div className="tnp-empty-icon">📋</div>
              <p>Select a patient from the list to view or create session notes.</p>
            </div>
          )}

          {view === 'overview' && selectedPatient && (
            <PatientOverview
              patient={selectedPatient}
              notes={patientNotes}
              onNewNote={startNew}
              onViewNote={openNote}
            />
          )}

          {view === 'new' && selectedPatient && (
            <div className="tnp-scroll-area">
              <NoteForm patient={selectedPatient} onSave={saveNote} onCancel={backToOverview} />
            </div>
          )}

          {view === 'viewer' && viewingNote && selectedPatient && (
            <div className="tnp-scroll-area">
              <NoteViewer note={viewingNote} patient={selectedPatient} onBack={backToOverview} />
            </div>
          )}
        </div>

      </div>
    </TherapistPageShell>
  )
}
