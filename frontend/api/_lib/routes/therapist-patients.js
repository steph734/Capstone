// Therapist "My Patients" API. THERAPIST ONLY; the therapist is always the signed-in session's employee record.
//   GET    /api/therapist/patients?search=&status=&needs_session=&sort=&page=&limit=
//   POST   /api/therapist/patients                       add a patient (+ first-session payment), header Idempotency-Key
//   GET    /api/therapist/patients/:id                   detail
//   PATCH  /api/therapist/patients/:id/archive | unarchive
//   GET    /api/therapist/patients/:id/delete-preview
//   DELETE /api/therapist/patients/:id                   { confirm_name }
//   POST   /api/therapist/patients/:id/resend-invite
//   GET    /api/therapist/registration-payments/:id/receipt
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor, audit } from '../noteAccess.js'
import { SESSION_FEE_PESOS } from '../pricing.js'
import {
  FEE_CENTAVOS, PatientError, sendPatientError, listPatients, patientDetail, archivePatient, unarchivePatient, deletePreview, deletePatient,
  createPatient, resendInvite, registrationReceipt,
} from '../therapistPatients.js'

export async function therapistOnly(req, res) {
  const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
  if (!ctx) return null
  const employee = await employeeFor(ctx.db, ctx.user)
  if (!employee) { res.status(403).json({ error: 'Your account is not linked to a staff record.', code: 'NOT_ALLOWED' }); return null }
  return { ...ctx, employee }
}

const allow = (res, methods) => { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }) }

export default async function handler(req, res) {
  const { id, action } = req.params || {}
  try {
    await getMongo()
    const ctx = await therapistOnly(req, res)
    if (!ctx) return
    const { db, employee, user } = ctx
    res.setHeader('Cache-Control', 'no-store')

    if (!id) {
      if (req.method === 'GET') {
        const out = await listPatients(db, employee, req.query || {})
        // The first-session fee is the SERVER's. The Add patient dialog only displays it.
        return res.status(200).json({ ...out, fee: { pesos: SESSION_FEE_PESOS, centavos: FEE_CENTAVOS }, therapist: { name: [employee.first_name, employee.last_name].filter(Boolean).join(' '), position: employee.position || employee.specialty || 'Therapist' } })
      }
      if (req.method === 'POST') {
        const out = await createPatient(db, employee, user, req.body || {}, String(req.headers['idempotency-key'] || ''))
        return res.status(out.replay ? 200 : 201).json(out)
      }
      return allow(res, ['GET', 'POST'])
    }

    if (!action) {
      if (req.method === 'GET') return res.status(200).json({ patient: await patientDetail(db, employee, id) })
      if (req.method === 'DELETE') {
        const out = await deletePatient(db, employee, user, id, req.body?.confirm_name)
        return res.status(200).json(out)
      }
      return allow(res, ['GET', 'DELETE'])
    }

    if (action === 'archive' || action === 'unarchive') {
      if (req.method !== 'PATCH') return allow(res, ['PATCH'])
      const out = action === 'archive' ? await archivePatient(db, employee, user, id) : await unarchivePatient(db, employee, id)
      if (!out.unchanged) await audit(db, { user, action: `patient_${action}`, patientId: out.id, ip: ctx.ip }).catch(() => {})
      return res.status(200).json(out)
    }
    if (action === 'delete-preview') {
      if (req.method !== 'GET') return allow(res, ['GET'])
      return res.status(200).json(await deletePreview(db, employee, id))
    }
    if (action === 'resend-invite') {
      if (req.method !== 'POST') return allow(res, ['POST'])
      return res.status(200).json(await resendInvite(db, employee, id))
    }
    return res.status(404).json({ error: 'Not found.' })
  } catch (err) {
    return sendPatientError(res, err, 'therapist patients')
  }
}

// GET /api/therapist/registration-payments/:id/receipt  (behind the session, never a public link)
export async function registrationReceiptRoute(req, res) {
  try {
    await getMongo()
    const ctx = await therapistOnly(req, res)
    if (!ctx) return
    const r = await registrationReceipt(ctx.db, ctx.employee, req.params.id)
    res.setHeader('Content-Type', r.contentType)
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).end(r.data)
  } catch (err) {
    if (err instanceof PatientError) return res.status(err.status).json({ error: err.message, code: err.code })
    console.error('registration receipt:', err.message)
    return res.status(500).json({ error: 'Could not load the receipt.' })
  }
}
