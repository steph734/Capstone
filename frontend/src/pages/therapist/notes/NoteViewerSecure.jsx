import { useCallback, useEffect, useState } from 'react'
import { openNote, noteHistory, addAddendum, voidNote, logExport } from './notesApi'
import { exportNotePdf, printNote } from './notePdf'
import { unescapeHtml } from '../../../utils/session'

// Read-only view of ONE note. It is fetched on open (so the server can check
// access, decrypt, verify the SHA-256 and write the "view" audit entry), never
// pre-loaded in a list. Signed notes can't be edited: corrections are
// addenda with a reason; a mistaken note is voided with a reason, never deleted.
const SECTIONS = [
  { key: 'subjective', label: '💬 Subjective', cls: 'tnp-s' },
  { key: 'objective', label: '👀 Objective', cls: 'tnp-o' },
  { key: 'assessment', label: '📊 Assessment', cls: 'tnp-a' },
  { key: 'plan', label: '🌟 Plan', cls: 'tnp-p' },
]
const box = (bg, fg, border) => ({ background: bg, color: fg, border: `1px solid ${border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, margin: '0 0 12px' })
const fieldErr = { color: '#b91c1c', fontSize: 12, display: 'block', marginTop: 4 }
const when = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const ACTION_LABEL = { create: 'Created', view: 'Viewed', edit: 'Edited draft', sign: 'Signed', addendum: 'Addendum added', share: 'Shared with guardian', unshare: 'Unshared', export: 'Exported (PDF)', print: 'Printed', void: 'Voided', denied: 'Access denied' }

export default function NoteViewerSecure({ noteId, patient, therapistName, onBack, onEditDraft, onChanged, onSessionError }) {
  const [note, setNote] = useState(null)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null) // 'history' | 'addendum' | 'void'
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ reason: '', text: '', password: '' })
  const [errors, setErrors] = useState({})

  const handleErr = useCallback((err) => {
    if (err.code === 'SESSION_LOCKED' || err.code === 'NO_SESSION') { onSessionError?.(err); return true }
    return false
  }, [onSessionError])

  const load = useCallback(() => {
    setError('')
    openNote(noteId).then(setNote).catch((err) => { if (!handleErr(err)) setError(err.message) })
  }, [noteId, handleErr])
  useEffect(load, [load])

  const loadHistory = () => noteHistory(noteId).then(setHistory).catch((err) => { if (!handleErr(err)) setError(err.message) })
  const toggle = (name) => {
    setErrors({}); setForm({ reason: '', text: '', password: '' })
    setPanel((p) => (p === name ? null : name))
    if (name === 'history' && panel !== 'history') loadHistory()
  }

  const submit = async (kind) => {
    setBusy(true); setErrors({})
    try {
      if (kind === 'addendum') await addAddendum(noteId, { reason: form.reason, text: form.text, password: form.password })
      else await voidNote(noteId, form.reason)
      setPanel(null); setForm({ reason: '', text: '', password: '' })
      load(); onChanged?.()
      if (history) loadHistory()
    } catch (err) {
      if (handleErr(err)) return
      setErrors({ ...(err.fields || {}), _: err.message })
    } finally { setBusy(false) }
  }

  const doExport = async (kind) => {
    try {
      await logExport(noteId, kind) // logged first: no log, no copy
      if (kind === 'export') await exportNotePdf(note, therapistName || 'Therapist')
      else printNote(note, therapistName || 'Therapist')
      if (history) loadHistory()
    } catch (err) {
      if (!handleErr(err)) setError(err.message)
    }
  }

  if (error && !note) return <div className="tnp-notebook"><div className="tnp-paper"><p style={{ color: '#b91c1c' }}>{error}</p><button className="tnp-ghost-btn" onClick={onBack}>← Back</button></div></div>
  if (!note) return <div className="tnp-notebook"><div className="tnp-paper"><p>Opening note…</p></div></div>

  const signed = note.status === 'signed'
  return (
    <div className="tnp-notebook">
      <div className="tnp-spiral" aria-hidden="true">{Array.from({ length: 14 }).map((_, i) => <div key={i} className="tnp-ring" />)}</div>
      <div className="tnp-paper">
        <div className="tnp-title-row">
          <h2 className="tnp-title">Session Note {note.voided ? '· VOID' : !signed ? '· DRAFT' : ''}</h2>
          <div className="tnp-date-box"><span className="tnp-field-label">📅 Date:</span><span className="tnp-field-val tnp-field-line">{note.date}</span></div>
        </div>
        <div className="tnp-field-row"><span className="tnp-field-label">👤 Patient:</span><span className="tnp-field-val tnp-field-line">{note.patientName || patient?.name}</span></div>
        <div className="tnp-field-row tnp-field-row-last"><span className="tnp-field-label">🩺 Diagnosis:</span><span className="tnp-field-val tnp-field-line">{unescapeHtml(note.diagnosis) || patient?.diagnosis}</span></div>
        <div className="tnp-rule" />

        {note.integrity === 'mismatch' && (
          <div role="alert" style={box('#fef2f2', '#991b1b', '#fecaca')}>
            <strong>⚠ Integrity warning.</strong> This note's contents do not match the fingerprint recorded when it was signed. It may have been altered outside the app. Do not rely on it, and report this to your administrator.
          </div>
        )}
        {note.integrity === 'unverified' && signed && (
          <div style={box('#f3f4f6', '#4b5563', '#e5e7eb')}>This older note was signed before integrity fingerprints existed, so it can't be verified.</div>
        )}
        {note.voided && (
          <div style={box('#fff7ed', '#9a3412', '#fed7aa')}>
            <strong>Voided {when(note.voidedAt)}.</strong> Reason: {unescapeHtml(note.voidReason)}. The note is kept for the record and is hidden from the guardian.
          </div>
        )}
        {note.share && <div style={box('#ecfdf5', '#065f46', '#a7f3d0')}>Shared with the guardian {when(note.share.sharedAt)}: {note.share.sections.length ? note.share.sections.join(', ') : 'summary only'}.</div>}

        {SECTIONS.map(({ key, label, cls }) => (
          <div key={key} className="tnp-section">
            <div className={`tnp-section-label ${cls}`}>{label}</div>
            <div className="tnp-view-body" style={{ whiteSpace: 'pre-wrap' }}>{unescapeHtml(note[key]) || '—'}</div>
          </div>
        ))}

        {note.addenda.length > 0 && (
          <div className="tnp-section">
            <div className="tnp-section-label">📎 Addenda</div>
            {note.addenda.map((a) => (
              <div key={a.id} className="tnp-view-body" style={{ borderTop: '1px dashed #cbd5d0', paddingTop: 8, marginTop: 8 }}>
                <strong>{when(a.signedAt)}</strong> — reason: {unescapeHtml(a.reason)}
                {a.integrity === 'mismatch' && <span style={{ color: '#b91c1c' }}> ⚠ altered</span>}
                <div style={{ whiteSpace: 'pre-wrap' }}>{unescapeHtml(a.text)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="tnp-sig-section">
          <div className="tnp-sig-row">
            <span className="tnp-sig-cheer">{signed ? `✍️ Signed ${when(note.signedAt)}${note.signedByName ? ` by ${note.signedByName}` : ''}` : 'Not signed yet'}</span>
            <div className="tnp-sig-right">
              {note.signatureImage ? <img src={note.signatureImage} alt="Therapist signature" className="tnp-sig-img" /> : <div className="tnp-sig-placeholder-line" />}
              <span className="tnp-sig-text">Therapist Signature</span>
            </div>
          </div>
        </div>

        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}

        <div className="tnp-form-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="tnp-ghost-btn" onClick={onBack}>← Back</button>
          <button className="tnp-ghost-btn" onClick={() => toggle('history')} aria-expanded={panel === 'history'}>🕘 History</button>
          {note.canEdit && !signed && !note.voided && <button className="tnp-primary-btn" onClick={() => onEditDraft(note)}>✏️ Edit draft</button>}
          {note.canEdit && signed && !note.voided && <button className="tnp-ghost-btn" onClick={() => toggle('addendum')} aria-expanded={panel === 'addendum'}>＋ Addendum</button>}
          {note.canEdit && !note.voided && <button className="tnp-ghost-btn" onClick={() => toggle('void')} aria-expanded={panel === 'void'} style={{ color: '#b45309' }}>Void…</button>}
          {signed && <button className="tnp-ghost-btn" onClick={() => doExport('export')}>⬇ PDF</button>}
          {signed && <button className="tnp-ghost-btn" onClick={() => doExport('print')}>🖨 Print</button>}
        </div>

        {panel === 'addendum' && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4b5563' }}>Signed notes can't be changed. Add a dated addendum explaining the correction; the original stays as written.</p>
            <label className="tnp-field-label" htmlFor="ad-reason">Reason for the addendum</label>
            <input id="ad-reason" className="tnp-textarea" style={{ minHeight: 40 }} value={form.reason} maxLength={1000} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            {errors.reason && <span style={fieldErr}>{errors.reason}</span>}
            <label className="tnp-field-label" htmlFor="ad-text" style={{ display: 'block', marginTop: 8 }}>Addendum</label>
            <textarea id="ad-text" className="tnp-textarea" rows={4} value={form.text} maxLength={5000} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            {errors.text && <span style={fieldErr}>{errors.text}</span>}
            <label className="tnp-field-label" htmlFor="ad-pw" style={{ display: 'block', marginTop: 8 }}>Re-enter your password to sign</label>
            <input id="ad-pw" type="password" autoComplete="current-password" className="tnp-textarea" style={{ minHeight: 40 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {(errors.password || errors._) && <span style={fieldErr}>{errors.password || errors._}</span>}
            <div style={{ marginTop: 10 }}><button className="tnp-primary-btn" disabled={busy} onClick={() => submit('addendum')}>{busy ? 'Saving…' : 'Sign addendum'}</button></div>
          </div>
        )}

        {panel === 'void' && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4b5563' }}>Notes are never deleted. Voiding keeps the note on record, marks it void, hides it from the guardian and stops any sharing.</p>
            <label className="tnp-field-label" htmlFor="void-reason">Reason for voiding</label>
            <input id="void-reason" className="tnp-textarea" style={{ minHeight: 40 }} value={form.reason} maxLength={1000} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            {(errors.reason || errors._) && <span style={fieldErr}>{errors.reason || errors._}</span>}
            <div style={{ marginTop: 10 }}><button className="tnp-primary-btn" style={{ background: '#b45309' }} disabled={busy} onClick={() => submit('void')}>{busy ? 'Voiding…' : 'Void this note'}</button></div>
          </div>
        )}

        {panel === 'history' && (
          <div style={{ marginTop: 14 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>History</h3>
            {!history ? <p style={{ fontSize: 13 }}>Loading…</p> : (
              <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
                  {history.history.map((h, i) => (
                    <li key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid #eef2f0' : 'none' }}>
                      <strong>{ACTION_LABEL[h.action] || h.action}</strong> · {h.by} ({h.role}) · {when(h.at)}{h.detail ? ` · ${unescapeHtml(h.detail)}` : ''}
                    </li>
                  ))}
                </ul>
                {history.versions.length > 0 && (
                  <p style={{ fontSize: 12, color: '#6b7c75', margin: '10px 0 0' }}>
                    Versions kept: {history.versions.map((v) => `v${v.version} ${v.kind}${v.hash ? ` (${v.hash}…)` : ''}`).join(' · ')}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
