import { useEffect, useRef, useState } from 'react'
import { sendEmail } from '../lib/emailApi'
import './EmailGuardianModal.css'

// Compose / reply modal for the in-app Email feature.
//
// Props:
//   currentUserEmail  (required) the logged-in sender's email
//   mode              'compose' | 'reply'  (default 'compose')
//   patient           { id, name }  — required for mode 'compose' (therapist only)
//   guardianName      display-only label for who this goes to
//   replyTo           { id, subject }  — required for mode 'reply'
//   draft             an existing draft email object to resume (optional)
//   onClose()
//   onSent(email)
export default function EmailGuardianModal({
  currentUserEmail,
  mode = 'compose',
  patient,
  guardianName,
  replyTo,
  draft,
  onClose,
  onSent,
}) {
  const isReply = mode === 'reply'
  const needsPatientPicker = !isReply && !patient && !draft?.patient_id
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState(draft?.patient_id || '')
  const [subject, setSubject] = useState(draft?.subject || (isReply && replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : ''))
  const [body, setBody] = useState(draft?.body || '')
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // A therapist opening Compose generally (not from a specific patient's
  // profile) needs to pick who it's about — the guardian is then resolved
  // server-side from that patient.
  useEffect(() => {
    if (!needsPatientPicker) return
    fetch(`/api/patients/therapist-list?email=${encodeURIComponent(currentUserEmail)}`)
      .then((r) => r.json())
      .then((data) => setPatients(data.patients || []))
      .catch(() => setPatients([]))
  }, [needsPatientPicker, currentUserEmail])

  const selectedPatient = patients.find((p) => p.id === patientId)
  const toLabel = isReply
    ? (guardianName || 'Reply')
    : patient
      ? (guardianName ? `${guardianName} (Guardian)` : 'Guardian')
      : (selectedPatient ? `${selectedPatient.guardian} (Guardian of ${selectedPatient.name})` : 'Choose a patient below')

  const buildPayload = (emailStatus) => ({
    senderEmail: currentUserEmail,
    subject,
    body,
    email_status: emailStatus,
    patient_id: patient?.id || patientId || draft?.patient_id || undefined,
    reply_to_email_id: isReply ? replyTo?.id : draft?.reply_to_email_id || undefined,
    draft_id: draft?.id || undefined,
  })

  const handleSend = async () => {
    if (needsPatientPicker && !patientId) {
      setError('Choose a patient first.')
      return
    }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const { email } = await sendEmail(buildPayload('sent'), files)
      setStatus('sent')
      onSent?.(email)
      setTimeout(onClose, 900)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Could not send this email.')
    }
  }

  const handleSaveDraft = async () => {
    if (!subject.trim() && !body.trim()) { onClose(); return }
    setStatus('sending')
    setError('')
    try {
      const { email } = await sendEmail(buildPayload('draft'), files)
      onSent?.(email)
      onClose()
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Could not save this draft.')
    }
  }

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...picked].slice(0, 5))
    e.target.value = ''
  }

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index))

  return (
    <div className="egm-overlay" onClick={handleSaveDraft}>
      <div className="egm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="egm-header">
          <span className="egm-title">{isReply ? 'Reply' : 'New Email'}</span>
          <button className="egm-close" onClick={handleSaveDraft} aria-label="Close">✕</button>
        </div>

        <div className="egm-field egm-to-row">
          <span className="egm-field-label">To</span>
          <span className="egm-recipient">{toLabel}</span>
        </div>

        {needsPatientPicker && (
          <div className="egm-field">
            <select className="egm-input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {!isReply && (
          <div className="egm-field">
            <input
              className="egm-input"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        )}

        <textarea
          className="egm-body"
          placeholder="Write your message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />

        {files.length > 0 && (
          <div className="egm-files">
            {files.map((f, i) => (
              <span key={i} className="egm-file-chip">
                {f.name}
                <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}>✕</button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="egm-error">{error}</p>}

        <div className="egm-footer">
          <button
            className={`egm-send-btn${status === 'sent' ? ' egm-sent' : ''}`}
            onClick={handleSend}
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sent' ? 'Sent!' : status === 'sending' ? 'Sending…' : 'Send'}
          </button>
          <button className="egm-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach files" type="button">
            📎 Attach
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            onChange={addFiles}
          />
        </div>
      </div>
    </div>
  )
}
