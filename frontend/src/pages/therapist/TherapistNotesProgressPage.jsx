import { useState, useRef, useEffect } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { useSharedProgress } from '../../context/ProgressContext'
import { manilaDateKey } from '../../utils/manilaTime'
import './TherapistNotesProgressPage.css'

const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']

// A stable placeholder avatar for a given id — same hash-to-pravatar trick
// used on the My Patients page, since patient ids here are Mongo ObjectId
// strings rather than small sequential ints.
function avatarFor(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `https://i.pravatar.cc/150?img=${(h % 70) + 1}`
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
// shape NoteForm/NoteViewer/PatientOverview already expect.
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
                  <td className="tnp-notes-table-date" data-label="Date">{n.date}</td>
                  <td className="tnp-notes-table-preview" data-label="Preview">{n.subjective?.slice(0, 90)}…</td>
                  <td data-label="Status">
                    {n.signed
                      ? <span className="tnp-signed-pill">✅ Signed</span>
                      : <span className="tnp-pending-pill">Pending</span>}
                  </td>
                  <td data-label="Parent Sharing">
                    {n.shareable
                      ? <span className="tnp-shared-pill">🏡 Shared</span>
                      : <span className="tnp-pending-pill">Private</span>}
                  </td>
                  <td className="tnp-cell-actions" data-label="">
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
          avatar: avatarFor(p.id),
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
  const patientNotes    = selectedId !== null ? (notes[selectedId] || []) : []

  // On phones the detail panel renders below the patient table, so tapping
  // "View Notes" / "+ New Note" would otherwise look like nothing happened —
  // bring the panel into view once it mounts / changes view.
  const detailRef = useRef(null)
  useEffect(() => {
    if (selectedId === null) return
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedId, view, viewingNote])

  const viewNotesFor = (id) => { setSelectedId(id); setView('overview'); setViewingNote(null) }
  const newNoteFor   = (id) => { setSelectedId(id); setView('new'); setViewingNote(null) }

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
                {patients.length === 0 ? (
                  <tr><td colSpan={6} className="tnp-table-empty">No patients yet — they'll show up here once they book with you.</td></tr>
                ) : patients.map(p => {
                  const pNotes = notes[p.id] || []
                  const last = pNotes[0]
                  return (
                    <tr key={p.id} className={selectedId === p.id ? 'tnp-row-active' : ''}>
                      <td className="tnp-cell-patient" data-label="Patient">
                        <div className="tnp-table-patient-cell">
                          <img className="tnp-patient-avatar" src={p.avatar} alt={p.name} />
                          <span className="tnp-patient-name">{p.name}</span>
                        </div>
                      </td>
                      <td data-label="Diagnosis">{p.diagnosis}</td>
                      <td className="tnp-table-notes-count" data-label="Total Notes">{pNotes.length}</td>
                      <td data-label="Last Note">{last ? last.date : '—'}</td>
                      <td data-label="Status">
                        {pNotes.length === 0
                          ? <span className="tnp-pending-pill">No notes</span>
                          : last.signed
                            ? <span className="tnp-signed-pill">✅ Signed</span>
                            : <span className="tnp-pending-pill">Pending</span>}
                      </td>
                      <td className="tnp-cell-actions" data-label="">
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
          <div className="tnp-detail-card" ref={detailRef}>
            <button
              type="button"
              className="tnp-detail-close"
              onClick={() => { setSelectedId(null); setView('overview'); setViewingNote(null) }}
            >
              ← Back to patient list
            </button>

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
      )}
    </TherapistPageShell>
  )
}
