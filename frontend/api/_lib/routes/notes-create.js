// POST /api/notes/create -> a new SOAP note: a draft, or (sign: true) a signed one.
// Authorisation comes from the session, never from the request body: the
// therapist must have an appointment with the patient, or this is a 403.
// The four SOAP fields are encrypted (AES-256-GCM) before they reach the
// database; signing re-checks the password and stores signed_by, signed_at and
// a SHA-256 content hash. Every version is kept in `soap_note_versions`.
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { checkPasswordReentry } from '../passwordCheck.js'
import { SOAP_FIELDS, encryptField, contentHash, validateSoap, cleanText } from '../soapCrypto.js'
import { employeeFor, isAssigned, audit } from '../noteAccess.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const SIGNATURE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Therapist'] })
    if (!ctx) return
    const { db, user, ip } = ctx
    const body = req.body || {}

    const employee = await employeeFor(db, user)
    if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.' })
    if (!ObjectId.isValid(body.patientId)) return res.status(400).json({ error: 'Invalid patient.' })
    const patientId = new ObjectId(String(body.patientId))
    if (!(await isAssigned(db, employee._id, patientId))) {
      await audit(db, { user, action: 'denied', patientId, ip, meta: { attempted: 'create' } })
      return res.status(403).json({ error: 'You are not assigned to this patient.' })
    }
    if (!DATE_RE.test(String(body.sessionDate || ''))) return res.status(400).json({ error: 'Invalid session date.' })
    const sign = body.sign === true

    const { errors, value } = validateSoap(body, { complete: sign })
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted sections.', fields: errors })
    if (sign) {
      if (!SIGNATURE_RE.test(String(body.signatureImage || '')) || body.signatureImage.length > 600000) {
        return res.status(400).json({ error: 'Draw your signature to sign this note.', fields: { signature: 'A signature is required.' } })
      }
      const check = await checkPasswordReentry(db, user, body.password)
      if (!check.ok) return res.status(check.locked ? 423 : 401).json({ error: check.error, locked: !!check.locked, fields: { password: check.error } })
    }

    const patient = await db.collection('patients').findOne({ _id: patientId }, { projection: { first_name: 1, last_name: 1 } })
    if (!patient) return res.status(404).json({ error: 'Patient not found.' })

    const _id = new ObjectId()
    const id = String(_id)
    const now = new Date()
    const encrypted = Object.fromEntries(SOAP_FIELDS.map((f) => [f, value[f] ? encryptField(value[f], id, f) : null]))
    const hash = sign ? contentHash(value) : null
    const doc = {
      _id, NoteID: id,
      appointment_id: null,
      employee_id: employee._id,
      employee_name: [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' '),
      patient_id: patientId,
      patient_name: [patient.first_name, patient.last_name].filter(Boolean).join(' ') || null,
      diagnosis: cleanText(body.diagnosis).slice(0, 150) || null,
      title: null,
      session_date: body.sessionDate,
      timezone: 'Asia/Manila',
      ...encrypted,
      status: sign ? 'signed' : 'draft',
      signature_image: sign ? body.signatureImage : null,
      signed_at: sign ? now : null,
      signed_by: sign ? employee._id : null,
      content_hash: hash,
      shared_with_guardian: false, shared_summary: null, shared_at: null,
      addendum_to: null,
      voided: false,
      version: 1,
      enc: 1,
      is_archived: false, archived_at: null,
      created_at: now, updated_at: now,
    }
    await db.collection('therapy_notes').insertOne(doc)
    await db.collection('soap_note_versions').insertOne({
      note_id: _id, version: 1, kind: sign ? 'sign' : 'create', ...encrypted, content_hash: hash,
      created_by: user._id, created_at: now,
    })
    await audit(db, { user, action: 'create', patientId, noteId: _id, ip })
    if (sign) await audit(db, { user, action: 'sign', patientId, noteId: _id, ip })

    return res.status(201).json({ id, status: doc.status, signedAt: doc.signed_at, createdAt: now, version: 1 })
  } catch (err) {
    console.error('notes/create error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not save the session note.' })
  }
}
