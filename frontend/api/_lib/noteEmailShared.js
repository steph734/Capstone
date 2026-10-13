// "A new note is available" email. It deliberately contains NO clinical
// content (no summary, no SOAP text, not even the session date): email is not
// a secure channel, so the guardian has to sign in to read the note.
import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function sendNoteSharedEmail(payload = {}) {
  const email = String(payload.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')
  const guardian = payload.guardianName ? String(payload.guardianName).trim() : ''
  const patient = payload.patientName ? String(payload.patientName).trim() : ''
  const therapist = payload.therapistName ? String(payload.therapistName).trim() : 'Your therapist'
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;"><div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
<h1 style="margin:0 0 4px;font-size:20px;">A new note is available</h1>
<p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${guardian ? `Hi ${esc(guardian)},` : 'Hi,'}</p>
<p style="margin:0 0 16px;font-size:14px;">${esc(therapist)} shared a new note${patient ? ` for ${esc(patient)}` : ''}. For your privacy, the note is not included in this email.</p>
<p style="margin:0;font-size:14px;">Sign in to ${esc(BRAND)} and open <strong>Notes</strong> to read it.</p>
</div></div></body></html>`
  const plain = `${guardian ? `Hi ${guardian},` : 'Hi,'}\n\n${therapist} shared a new note${patient ? ` for ${patient}` : ''}. For your privacy the note is not included in this email.\nSign in to ${BRAND} and open Notes to read it.\n`
  return sendEmail({ to: email, toName: guardian || undefined, subject: `${BRAND}: a new note is available${patient ? ` for ${patient}` : ''}`, html, plain })
}
