// /api/notes/:id[/:action] — open, edit-draft, sign, addendum, void, share,
// unshare, audit (export/print) and history for ONE note.
//
//   GET    /api/notes/:id                 open (decrypt, verify hash, audit "view")
//   PATCH  /api/notes/:id                 edit a DRAFT (new version)
//   POST   /api/notes/:id/sign            sign a draft (password re-entry)
//   POST   /api/notes/:id/addendum        correct a signed note (reason + password)
//   POST   /api/notes/:id/void            void instead of deleting (reason)
//   POST   /api/notes/:id/share           share chosen sections with the guardian
//   POST   /api/notes/:id/unshare
//   POST   /api/notes/:id/audit           record an export / print
//   GET    /api/notes/:id/history         audit trail + versions
//
// Access is decided from the verified session and the patient assignment:
//   Therapist -> must have an appointment with the patient (else 403)
//   Guardian  -> only signed, un-voided notes actively shared, only the shared sections
//   Owner     -> full text only with a stated reason, which is logged
// There is no hard delete anywhere in this file.
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { checkPasswordReentry } from '../passwordCheck.js'
import { SOAP_FIELDS, encryptField, decryptField, contentHash, addendumHash, validateSoap, validateReason, cleanText } from '../soapCrypto.js'
import { employeeFor, isAssigned, guardianPatientIds, audit, decryptSoap, integrityOf, decryptAddendum, SECTION_LABEL } from '../noteAccess.js'
import { sendNoteSharedEmail } from '../noteEmailShared.js'
import { SIGNATURE_RE } from './notes-create.js'

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra })

export default async function handler(req, res) {
  const id = req.params?.id
  const action = req.params?.action || ''
  if (!ObjectId.isValid(id)) return fail(res, 400, 'Invalid note id.')
  const known = { '': ['GET', 'PATCH'], sign: ['POST'], addendum: ['POST'], void: ['POST'], share: ['POST'], unshare: ['POST'], audit: ['POST'], history: ['GET'] }
  if (!known[action]) return fail(res, 404, 'Not found.')
  if (!known[action].includes(req.method)) { res.setHeader('Allow', known[action].join(', ')); return fail(res, 405, 'Method not allowed') }

  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Therapist', 'Owner', 'Patient'] })
    if (!ctx) return
    const { db, user, ip } = ctx
    const _id = new ObjectId(id)
    const note = await db.collection('therapy_notes').findOne({ _id, addendum_to: null })
    if (!note) return fail(res, 404, 'Note not found.')
    const body = req.body || {}
    const role = user.role

    // ── Who may touch this note ─────────────────────────────────────────
    let employee = null
    if (role === 'Therapist') {
      employee = await employeeFor(db, user)
      if (!employee || !(await isAssigned(db, employee._id, note.patient_id))) {
        await audit(db, { user, action: 'denied', patientId: note.patient_id, noteId: _id, ip, meta: { attempted: action || req.method } })
        return fail(res, 403, 'You are not assigned to this patient.')
      }
    } else if (role === 'Owner') {
      // Owners can read, with a reason, and see the history; nothing else.
      if (!(req.method === 'GET' && (action === '' || action === 'history'))) return fail(res, 403, 'Owners can only view notes.')
    } else if (role === 'Patient') {
      if (!(req.method === 'GET' && action === '')) return fail(res, 403, 'You can only read notes shared with you.')
    }
    const isAuthor = employee && String(note.employee_id) === String(employee._id)
    const needAuthor = () => (isAuthor ? null : fail(res, 403, 'Only the therapist who wrote this note can do that.'))

    // ── Open ─────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === '') {
      let reason = null
      if (role === 'Owner') {
        const r = validateReason(req.query.reason)
        if (r.error) return fail(res, 400, 'State why you need to open this note (at least 10 characters).', { reasonRequired: true })
        reason = r.value
      }
      let share = await db.collection('note_shares').findOne({ note_id: _id, revoked_at: null })
      if (role === 'Patient') {
        const mine = await guardianPatientIds(db, user.email)
        if (!mine.some((p) => String(p) === String(note.patient_id)) || note.status !== 'signed' || note.voided || !share) {
          return fail(res, 404, 'Note not found.')
        }
      }
      const fields = decryptSoap(note)
      const integrity = integrityOf(note, fields)
      await audit(db, { user, action: 'view', patientId: note.patient_id, noteId: _id, ip, meta: reason ? { reason } : integrity === 'mismatch' ? { integrity } : null })

      if (role === 'Patient') {
        const shown = Object.fromEntries(share.sections.map((s) => [s, fields[s]]))
        return res.status(200).json({ note: { id, date: note.session_date, therapistName: note.employee_name, domain: share.domain || null, summary: share.summary || '', sections: shown, sharedAt: share.shared_at } })
      }

      const addenda = await db.collection('therapy_notes').find({ addendum_to: _id }).sort({ signed_at: 1 }).toArray()
      return res.status(200).json({
        note: {
          id, patientId: String(note.patient_id), patientName: note.patient_name, diagnosis: note.diagnosis,
          date: note.session_date, status: note.status, version: note.version || 1,
          ...fields, integrity,
          signedAt: note.signed_at, signedByName: note.signed_at ? note.employee_name : null,
          signatureImage: role === 'Therapist' ? note.signature_image : null,
          voided: !!note.voided, voidReason: note.voided ? decryptField(note.void_reason, id, 'void_reason') : null, voidedAt: note.voided_at || null,
          share: share ? { sections: share.sections, summary: share.summary || '', domain: share.domain || null, sharedAt: share.shared_at } : null,
          addenda: addenda.map(decryptAddendum),
          canEdit: role === 'Therapist' && isAuthor,
        },
      })
    }

    // ── History ──────────────────────────────────────────────────────────
    if (action === 'history') {
      const [logs, versions] = await Promise.all([
        db.collection('audit_logs').find({ note_id: _id }).sort({ created_at: -1 }).limit(200).toArray(),
        db.collection('soap_note_versions').find({ note_id: _id }, { projection: { version: 1, kind: 1, created_at: 1, created_by: 1, content_hash: 1 } }).sort({ version: -1 }).toArray(),
      ])
      const ids = [...new Set([...logs.map((l) => l.user_id), ...versions.map((v) => v.created_by)].filter(Boolean).map(String))]
      const people = ids.length ? await db.collection('users').find({ _id: { $in: ids.map((x) => new ObjectId(x)) } }, { projection: { full_name: 1 } }).toArray() : []
      const nameBy = new Map(people.map((p) => [String(p._id), p.full_name]))
      return res.status(200).json({
        history: logs.map((l) => ({ action: l.action, role: l.role, by: nameBy.get(String(l.user_id)) || 'Unknown', at: l.created_at, detail: l.meta?.reason || l.meta?.sections?.join(', ') || l.meta?.event || l.meta?.attempted || null })),
        versions: versions.map((v) => ({ version: v.version, kind: v.kind, at: v.created_at, by: nameBy.get(String(v.created_by)) || 'Unknown', hash: v.content_hash ? v.content_hash.slice(0, 12) : null })),
      })
    }

    // ── Everything below is therapist-only ───────────────────────────────
    const patientId = note.patient_id
    const now = new Date()
    const saveVersion = (kind, fields, hash, extra = {}) => db.collection('soap_note_versions').insertOne({
      note_id: _id, version: (note.version || 1) + (kind === 'void' ? 0 : 1), kind, ...fields, content_hash: hash, created_by: user._id, created_at: now, ...extra,
    })

    if (action === 'audit') {
      const event = String(body.event || '')
      if (!['export', 'print'].includes(event)) return fail(res, 400, 'Unknown event.')
      await audit(db, { user, action: event, patientId, noteId: _id, ip })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'PATCH') {
      const denied = needAuthor(); if (denied) return
      if (note.status !== 'draft' || note.voided) return fail(res, 409, 'Signed notes are read-only. Add an addendum instead.')
      const { errors, value } = validateSoap(body, { complete: false })
      if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted sections.', { fields: errors })
      const enc = Object.fromEntries(SOAP_FIELDS.map((f) => [f, value[f] ? encryptField(value[f], id, f) : null]))
      await db.collection('therapy_notes').updateOne({ _id }, { $set: { ...enc, version: (note.version || 1) + 1, updated_at: now } })
      await saveVersion('edit', enc, null)
      await audit(db, { user, action: 'edit', patientId, noteId: _id, ip })
      return res.status(200).json({ ok: true, version: (note.version || 1) + 1 })
    }

    if (action === 'sign') {
      const denied = needAuthor(); if (denied) return
      if (note.status !== 'draft' || note.voided) return fail(res, 409, 'This note is already signed or voided.')
      const { errors, value } = validateSoap(body, { complete: true })
      if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted sections.', { fields: errors })
      if (!SIGNATURE_RE.test(String(body.signatureImage || '')) || body.signatureImage.length > 600000) return fail(res, 400, 'Draw your signature to sign this note.', { fields: { signature: 'A signature is required.' } })
      const check = await checkPasswordReentry(db, user, body.password)
      if (!check.ok) return fail(res, check.locked ? 423 : 401, check.error, { locked: !!check.locked, fields: { password: check.error } })
      const enc = Object.fromEntries(SOAP_FIELDS.map((f) => [f, encryptField(value[f], id, f)]))
      const hash = contentHash(value)
      await db.collection('therapy_notes').updateOne({ _id }, { $set: { ...enc, status: 'signed', signature_image: body.signatureImage, signed_at: now, signed_by: employee._id, content_hash: hash, version: (note.version || 1) + 1, updated_at: now } })
      await saveVersion('sign', enc, hash)
      await audit(db, { user, action: 'sign', patientId, noteId: _id, ip })
      return res.status(200).json({ ok: true, signedAt: now })
    }

    if (action === 'addendum') {
      const denied = needAuthor(); if (denied) return
      if (note.status !== 'signed' || note.voided) return fail(res, 409, 'Only a signed note can have an addendum.')
      const reason = validateReason(body.reason)
      if (reason.error) return fail(res, 400, reason.error, { fields: { reason: reason.error } })
      const textLen = String(body.text || '').trim().length
      if (textLen < 10 || textLen > 5000) return fail(res, 400, 'The addendum needs between 10 and 5000 characters.', { fields: { text: 'Write between 10 and 5000 characters.' } })
      const check = await checkPasswordReentry(db, user, body.password)
      if (!check.ok) return fail(res, check.locked ? 423 : 401, check.error, { locked: !!check.locked, fields: { password: check.error } })
      const text = cleanText(body.text)
      const aId = new ObjectId()
      const aid = String(aId)
      const hash = addendumHash({ reason: reason.value, text })
      await db.collection('therapy_notes').insertOne({
        _id: aId, NoteID: aid, appointment_id: null, employee_id: employee._id, employee_name: note.employee_name || null,
        patient_id: patientId, patient_name: note.patient_name, diagnosis: note.diagnosis, title: null,
        session_date: note.session_date, timezone: 'Asia/Manila',
        subjective: null, objective: null, assessment: null, plan: null,
        addendum_to: _id, addendum_reason: encryptField(reason.value, aid, 'addendum_reason'), addendum_text: encryptField(text, aid, 'addendum_text'),
        status: 'signed', signature_image: null, signed_at: now, signed_by: employee._id, content_hash: hash,
        shared_with_guardian: false, shared_summary: null, shared_at: null, voided: false, version: 1, enc: 1,
        is_archived: false, archived_at: null, created_at: now, updated_at: now,
      })
      await db.collection('soap_note_versions').insertOne({ note_id: aId, version: 1, kind: 'addendum', addendum_to: _id, content_hash: hash, created_by: user._id, created_at: now })
      await audit(db, { user, action: 'addendum', patientId, noteId: _id, ip, meta: { reason: reason.value, addendumId: aid } })
      return res.status(201).json({ ok: true, addendum: decryptAddendum(await db.collection('therapy_notes').findOne({ _id: aId })) })
    }

    if (action === 'void') {
      const denied = needAuthor(); if (denied) return
      if (note.voided) return fail(res, 409, 'This note is already void.')
      const reason = validateReason(body.reason)
      if (reason.error) return fail(res, 400, reason.error, { fields: { reason: reason.error } })
      await db.collection('therapy_notes').updateOne({ _id }, { $set: { voided: true, void_reason: encryptField(reason.value, id, 'void_reason'), voided_at: now, voided_by: employee._id, shared_with_guardian: false, shared_summary: null, shared_at: null, updated_at: now } })
      await db.collection('note_shares').updateMany({ note_id: _id, revoked_at: null }, { $set: { revoked_at: now, revoked_by: user._id } })
      await saveVersion('void', {}, note.content_hash || null, { reason: encryptField(reason.value, id, 'version_reason') })
      await audit(db, { user, action: 'void', patientId, noteId: _id, ip, meta: { reason: reason.value } })
      return res.status(200).json({ ok: true })
    }

    if (action === 'share') {
      if (note.status !== 'signed' || note.voided) return fail(res, 409, 'Only a signed note can be shared.')
      const sections = [...new Set(Array.isArray(body.sections) ? body.sections.filter((s) => SOAP_FIELDS.includes(s)) : [])]
      const summary = cleanText(body.summary).slice(0, 1000)
      if (!sections.length && !summary) return fail(res, 400, 'Choose at least one section to share, or write a parent-friendly summary.')
      const domain = cleanText(body.domain).slice(0, 150) || null
      await db.collection('note_shares').updateMany({ note_id: _id, revoked_at: null }, { $set: { revoked_at: now, revoked_by: user._id } })
      await db.collection('note_shares').insertOne({ note_id: _id, patient_id: patientId, sections, summary: summary || null, domain, shared_by: user._id, shared_at: now, revoked_at: null })
      await db.collection('therapy_notes').updateOne({ _id }, { $set: { shared_with_guardian: true, shared_summary: summary || null, shared_at: now, title: domain, updated_at: now } })
      await audit(db, { user, action: 'share', patientId, noteId: _id, ip, meta: { sections } })
      // "A new note is available" — never the content itself.
      let emailed = false
      try {
        const patient = await db.collection('patients').findOne({ _id: patientId }, { projection: { email: 1, guardian_first_name: 1, guardian_last_name: 1 } })
        if (patient?.email) {
          await sendNoteSharedEmail({ email: patient.email, guardianName: [patient.guardian_first_name, patient.guardian_last_name].filter(Boolean).join(' '), patientName: note.patient_name, therapistName: note.employee_name })
          emailed = true
        }
      } catch (err) {
        console.error('notes/share: notification email failed:', err.message)
      }
      return res.status(200).json({ ok: true, sections, sectionLabels: sections.map((s) => SECTION_LABEL[s]), emailed })
    }

    if (action === 'unshare') {
      await db.collection('note_shares').updateMany({ note_id: _id, revoked_at: null }, { $set: { revoked_at: now, revoked_by: user._id } })
      await db.collection('therapy_notes').updateOne({ _id }, { $set: { shared_with_guardian: false, shared_summary: null, shared_at: null, updated_at: now } })
      await audit(db, { user, action: 'unshare', patientId, noteId: _id, ip })
      return res.status(200).json({ ok: true })
    }

    return fail(res, 404, 'Not found.')
  } catch (err) {
    console.error('notes/:id error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
