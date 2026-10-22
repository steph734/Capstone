// Authorization + audit helpers for the SOAP-note routes. Every decision here
// is made from the verified session, never from a query-string patient or
// email the browser supplies.
import { SOAP_FIELDS, decryptField, encryptField, isEncrypted, contentHash, addendumHash } from './soapCrypto.js'

// Employee (therapist) record for a signed-in user, matched on login email.
export async function employeeFor(db, user) {
  return db.collection('employees').findOne({ email: String(user.email).toLowerCase() })
}

// A therapist is assigned to a patient when they have an appointment with
// them — the same link used everywhere else in the app.
export async function isAssigned(db, employeeId, patientId) {
  return Boolean(await db.collection('appointments').findOne({ employee_id: employeeId, patient_id: patientId }, { projection: { _id: 1 } }))
}

// A guardian's patient records (matched on the account email, like the rest of the app).
export async function guardianPatientIds(db, email) {
  const rows = await db.collection('patients').find({ email: String(email).toLowerCase() }, { projection: { _id: 1 } }).toArray()
  return rows.map((r) => r._id)
}

// Insert-only audit trail. This is the only code that touches `audit_logs`:
// there is deliberately no update or delete path anywhere. (For defence in
// depth, give the application's database user insert/find only on this
// collection.)
// Plain-English wording for the Super Admin "Audit Logs" page (collection `auditlogs`:
// user, action, IP address, description, time). The description never contains note text
// or patient names, only the kind of action and the note id.
const AUDIT_WORDS = {
  create: 'created a session note', view: 'viewed a session note', edit: 'saved a draft of a session note',
  sign: 'signed a session note', sign_failed: 'entered a wrong password while signing a note',
  sign_locked: 'was locked out of signing for 15 minutes after 5 wrong passwords', addendum: 'added an addendum to a signed note',
  share: 'shared a note with the guardian', unshare: 'stopped sharing a note', void: 'voided a note',
  export: 'exported a note as PDF', print: 'printed a note', voice_log_exported: 'downloaded a voice log',
  soap_voice_used: 'used voice dictation in a note', denied: 'was denied access to session notes',
}

export async function audit(db, { user, role, action, patientId = null, noteId = null, ip = null, meta = null }) {
  const now = new Date()
  try {
    // Detailed trail: who, what, which patient and note, with optional details.
    await db.collection('audit_logs').insertOne({
      user_id: user?._id || null, role: role || user?.role || null, action,
      patient_id: patientId, note_id: noteId, ip, created_at: now,
      ...(meta ? { meta } : {}),
    })
  } catch (err) {
    console.error('audit_logs insert failed:', err.message)
    throw Object.assign(new Error('Could not record this action in the audit log, so it was not completed.'), { status: 500 })
  }
  // Readable copy for the Audit Logs page. Best effort: the detailed row above already exists.
  if (user?._id) {
    try {
      const words = AUDIT_WORDS[action] || action
      const attempted = action === 'denied' && meta?.attempted ? ` (tried: ${meta.attempted})` : ''
      await db.collection('auditlogs').insertOne({
        user_id: user._id, action, ip_address: String(ip || 'unknown'),
        description: `${role || user.role || 'User'} ${words}${noteId ? ` [note ${String(noteId)}]` : ''}${attempted}`,
        created_at: now,
      })
    } catch (err) {
      console.error('auditlogs mirror failed:', err.message)
    }
  }
}

export async function viewedRecently(db, userId, noteId, ms = 10 * 60 * 1000) {
  return Boolean(await db.collection('audit_logs').findOne({ user_id: userId, note_id: noteId, action: 'view', created_at: { $gte: new Date(Date.now() - ms) } }, { projection: { _id: 1 } }))
}

// The drawn signature is stored encrypted (same AES-256-GCM, bound to the note id).
// Older notes hold it as a plain data URL until the migration script runs, so both are read.
export const sealSignature = (dataUrl, noteId) => (dataUrl ? encryptField(dataUrl, String(noteId), 'signature_image') : null)
export function readSignature(n) {
  if (!n?.signature_image) return null
  if (!isEncrypted(n.signature_image)) return n.signature_image
  try { return decryptField(n.signature_image, String(n._id), 'signature_image') } catch { return null }
}

// Decrypts the four SOAP fields of a stored note.
export function decryptSoap(n) {
  const id = String(n._id)
  const out = {}
  for (const f of SOAP_FIELDS) out[f] = decryptField(n[f], id, f) ?? ''
  return out
}

// Compares the stored SHA-256 with the decrypted text. Drafts and rows that
// pre-date hashing report 'unverified' rather than 'ok'.
export function integrityOf(n, fields) {
  if (!n.content_hash) return 'unverified'
  return contentHash(fields) === n.content_hash ? 'ok' : 'mismatch'
}

export function decryptAddendum(a) {
  const id = String(a._id)
  const text = decryptField(a.addendum_text, id, 'addendum_text') ?? ''
  const reason = decryptField(a.addendum_reason, id, 'addendum_reason') ?? ''
  const integrity = a.content_hash ? (addendumHash({ reason, text }) === a.content_hash ? 'ok' : 'mismatch') : 'unverified'
  return { id, reason, text, signedAt: a.signed_at, signedByName: a.employee_name || null, integrity }
}

// What the therapist's list shows: status and sharing, never the note text.
export function noteMeta(n, extra = {}) {
  return {
    id: String(n._id),
    patientId: String(n.patient_id),
    patientName: n.patient_name,
    diagnosis: n.diagnosis,
    date: n.session_date,
    status: n.status,
    voided: !!n.voided,
    signedAt: n.signed_at,
    createdAt: n.created_at,
    version: n.version || 1,
    domain: n.title,
    voiceUsed: !!n.voice_used,
    voiceLogCount: n.voice_log_count || 0,
    ...extra,
  }
}

export const SECTION_LABEL = { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' }
