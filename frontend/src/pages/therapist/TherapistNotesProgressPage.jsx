import { useState, useRef } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { useSharedProgress } from '../../context/ProgressContext'
import './TherapistNotesProgressPage.css'

const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']

// Alvrin (id 0) is the shared demo patient wired to the parent-facing
// Progress page via ProgressContext — same pattern as MessagesContext.
const PATIENTS = [
  { id: 0, name: 'Alvrin',      diagnosis: 'Anxiety Disorder',                   avatar: 'https://i.pravatar.cc/150?img=33' },
  { id: 1, name: 'Aira Lopez',  diagnosis: 'Speech delay — expressive language', avatar: '/patients/images%20(8).jpg' },
  { id: 2, name: 'Mika Santos', diagnosis: 'Articulation disorder',               avatar: '/patients/images%20(9).jpg' },
  { id: 3, name: 'Noah Cruz',   diagnosis: 'Developmental delay — F82',           avatar: '/patients/images%20(7).jpg' },
]

const INITIAL_NOTES = {
  0: [{
    id: 'n0a', date: 'Jun 30, 2026', shortDate: 'Jun 30',
    subjective: 'Alvrin reports feeling calmer this week and completed all assigned balance exercises at home.',
    objective:  'Single-leg balance improved to 12 seconds (up from 8). Engaged fully for the full session.',
    assessment: 'Good progress on coordination and balance. Anxiety triggers less frequent during session.',
    plan:       'Continue balance program. Introduce a new coordination game next session.',
    signatureData: null, signed: true, shareable: true, domain: 'Physical',
    parentSummary: 'Getting stronger every session — Alvrin is showing great improvement with balance and coordination!',
  }],
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
  const [shareWithParent, setShareWithParent] = useState(false)
  const [parentSummary,   setParentSummary]   = useState('')
  const [domain,          setDomain]          = useState(DOMAINS[0])

  const set = (field) => (e) => setSoap(prev => ({ ...prev, [field]: e.target.value }))
  const allFilled = soap.subjective.trim() && soap.objective.trim() && soap.assessment.trim() && soap.plan.trim()
  const shareReady = !shareWithParent || parentSummary.trim()

  const handleSave = () => {
    if (!allFilled)  { alert('Please fill in all SOAP fields before saving.'); return }
    if (!sigData)    { alert('Please sign the note before saving.'); return }
    if (!shareReady) { alert('Please add a parent-friendly summary before sharing this note.'); return }
    onSave({
      id: `n${Date.now()}`, date: today, shortDate: todayShort, ...soap,
      signatureData: sigData, signed: true,
      shareable: shareWithParent, domain, parentSummary: shareWithParent ? parentSummary.trim() : '',
    })
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
            className={`tnp-primary-btn${(!allFilled || !sigData || !shareReady) ? ' tnp-btn-dim' : ''}`}
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
function PatientOverview({ patient, notes, onNewNote, onViewNote, onToggleShare }) {
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
        <div className="tnp-notes-table-wrap">
          <table className="tnp-notes-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Preview</th>
                <th>Status</th>
                <th>Parent Sharing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notes.map(n => (
                <tr key={n.id}>
                  <td className="tnp-notes-table-date">{n.date}</td>
                  <td className="tnp-notes-table-preview">{n.subjective?.slice(0, 90)}…</td>
                  <td>
                    {n.signed
                      ? <span className="tnp-signed-pill">✅ Signed</span>
                      : <span className="tnp-pending-pill">Pending</span>}
                  </td>
                  <td>
                    {n.shareable
                      ? <span className="tnp-shared-pill">🏡 Shared</span>
                      : <span className="tnp-pending-pill">Private</span>}
                  </td>
                  <td>
                    <div className="tnp-table-actions">
                      <button className="tnp-table-view-btn" onClick={() => onViewNote(n)}>View</button>
                      <button className="tnp-share-toggle-btn" onClick={() => onToggleShare(n)}>
                        {n.shareable ? 'Unshare' : 'Share'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TherapistNotesProgressPage({ user, onLogout, betaTier }) {
  const [notes,       setNotes]       = useState(INITIAL_NOTES)
  const [selectedId,  setSelectedId]  = useState(null)
  const [view,        setView]        = useState('overview')  // 'overview' | 'new' | 'viewer'
  const [viewingNote, setViewingNote] = useState(null)
  const { shareNote, unshareNote } = useSharedProgress()

  const selectedPatient = PATIENTS.find(p => p.id === selectedId)
  const patientNotes    = selectedId !== null ? (notes[selectedId] || []) : []

  const viewNotesFor = (id) => { setSelectedId(id); setView('overview'); setViewingNote(null) }
  const newNoteFor   = (id) => { setSelectedId(id); setView('new'); setViewingNote(null) }

  const openNote  = (note) => { setViewingNote(note); setView('viewer') }
  const startNew  = ()     => { setView('new'); setViewingNote(null) }

  const saveNote = (note) => {
    setNotes(prev => ({ ...prev, [selectedId]: [note, ...(prev[selectedId] || [])] }))
    // Alvrin (id 0) is the demo patient wired to the parent-facing Progress page.
    if (selectedId === 0 && note.shareable) {
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

  const toggleShare = (note) => {
    const nextShareable = !note.shareable
    setNotes(prev => ({
      ...prev,
      [selectedId]: prev[selectedId].map(n => n.id === note.id ? { ...n, shareable: nextShareable } : n),
    }))
    if (selectedId === 0) {
      if (nextShareable) {
        shareNote({
          id: `sn-${note.id}`,
          date: note.date,
          domain: note.domain || DOMAINS[0],
          summary: note.parentSummary || note.assessment,
        })
      } else {
        unshareNote(`sn-${note.id}`)
      }
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
      <div className="tnp-page">

        {/* ── Patient table ── */}
        <div className="tnp-table-card">
          <div className="tnp-table-scroll">
            <table className="tnp-full-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Diagnosis</th>
                  <th>Total Notes</th>
                  <th>Last Note</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {PATIENTS.map(p => {
                  const pNotes = notes[p.id] || []
                  const last = pNotes[0]
                  return (
                    <tr key={p.id} className={selectedId === p.id ? 'tnp-row-active' : ''}>
                      <td>
                        <div className="tnp-table-patient-cell">
                          <img className="tnp-patient-avatar" src={p.avatar} alt={p.name} />
                          <span className="tnp-patient-name">{p.name}</span>
                        </div>
                      </td>
                      <td>{p.diagnosis}</td>
                      <td className="tnp-table-notes-count">{pNotes.length}</td>
                      <td>{last ? last.date : '—'}</td>
                      <td>
                        {pNotes.length === 0
                          ? <span className="tnp-pending-pill">No notes</span>
                          : last.signed
                            ? <span className="tnp-signed-pill">✅ Signed</span>
                            : <span className="tnp-pending-pill">Pending</span>}
                      </td>
                      <td>
                        <div className="tnp-table-actions">
                          <button className="tnp-table-view-btn" onClick={() => viewNotesFor(p.id)}>View Notes</button>
                          <button className="tnp-table-new-btn" onClick={() => newNoteFor(p.id)}>+ New Note</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Detail panel for the selected patient ── */}
        {selectedPatient && (
          <div className="tnp-detail-card">
            {view === 'overview' && (
              <PatientOverview
                patient={selectedPatient}
                notes={patientNotes}
                onNewNote={startNew}
                onViewNote={openNote}
                onToggleShare={toggleShare}
              />
            )}

            {view === 'new' && (
              <div className="tnp-scroll-area">
                <NoteForm patient={selectedPatient} onSave={saveNote} onCancel={backToOverview} />
              </div>
            )}

            {view === 'viewer' && viewingNote && (
              <div className="tnp-scroll-area">
                <NoteViewer note={viewingNote} patient={selectedPatient} onBack={backToOverview} />
              </div>
            )}
          </div>
        )}

      </div>
    </TherapistPageShell>
  )
}
