// /api/booking-flow?action=...  The role is always read from the session, never from the request.
//   Owner      GET  ownerPaymentQueue     POST ownerVerifyPayment { appointmentId }     POST ownerRejectPayment { appointmentId, reason, message }
//   Patient    GET  guardianBookings      POST guardianResubmitPayment&appointmentId=  (multipart: reference, receipt; header Idempotency-Key)
//   Therapist  POST therapistRespond { appointmentId, action: 'accept'|'decline', reason? }     (the list is GET /api/therapist/requests)
//   any        GET  badge                 the count for the sidebar
import multer from 'multer'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor, audit } from '../noteAccess.js'
import { tooManyRequests } from '../rateLimit.js'
import { MAX_RECEIPT_BYTES } from '../paymentProofRules.js'
import { ReviewError } from '../requestReview.js'
import * as flow from '../bookingFlow.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RECEIPT_BYTES + 1, files: 1, fields: 4 } }).single('receipt')
const runUpload = (req, res) => new Promise((resolve, reject) => upload(req, res, (err) => {
  if (!err) return resolve()
  const big = err.code === 'LIMIT_FILE_SIZE'
  reject(new ReviewError(big ? 413 : 400, big ? 'FILE_TOO_LARGE' : 'PROOF_REQUIRED', big ? 'That image is larger than 5 MB. Choose a smaller screenshot.' : 'We could not read your upload.'))
}))

const ACTIONS = {
  ownerPaymentQueue: { method: 'GET', roles: ['Owner'] },
  ownerVerifyPayment: { method: 'POST', roles: ['Owner'] },
  ownerRejectPayment: { method: 'POST', roles: ['Owner'] },
  guardianBookings: { method: 'GET', roles: ['Patient'] },
  guardianResubmitPayment: { method: 'POST', roles: ['Patient'] },
  therapistRespond: { method: 'POST', roles: ['Therapist'] },
  badge: { method: 'GET', roles: ['Owner', 'Therapist', 'Patient', 'Super Admin'] },
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '')
  const rule = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null
  if (!rule) return res.status(404).json({ error: 'Not found.' })
  if (req.method !== rule.method) { res.setHeader('Allow', rule.method); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: rule.roles, auditDenied: true, idle: false })
    if (!ctx) return
    const { db, user, ip } = ctx
    res.setHeader('Cache-Control', 'no-store')
    if (rule.method === 'POST' && await tooManyRequests(res, `flow:${user._id}`, { max: 60, windowMs: 10 * 60 * 1000 })) return
    const employee = user.role === 'Therapist' ? await employeeFor(db, user) : null
    const log = (what, appt, meta = {}) => audit(db, { user, action: what, patientId: appt?.patient_id || null, ip, meta: { appointment: String(appt?._id), ...meta } }).catch(() => {})
    // the appointment document itself is never sent back
    const reply = (result) => { const out = { ...result }; delete out.appointment; return res.status(200).json({ ok: true, ...out }) }

    if (action === 'badge') return res.status(200).json({ count: await flow.badgeCount(db, user.role, employee) })
    if (action === 'ownerPaymentQueue') return res.status(200).json(await flow.ownerQueue(db))
    if (action === 'guardianBookings') return res.status(200).json(await flow.guardianBookings(db, user))
    if (action === 'ownerVerifyPayment') {
      const out = await flow.ownerVerify(db, user, req.body?.appointmentId)
      if (!out.already) await log('payment_verified', out.appointment)
      return reply(out)
    }
    if (action === 'ownerRejectPayment') {
      const out = await flow.ownerReject(db, user, req.body?.appointmentId, req.body || {})
      if (!out.already) await log('payment_rejected', out.appointment, { reason: req.body?.reason })
      return reply(out)
    }
    if (action === 'guardianResubmitPayment') {
      const key = String(req.headers['idempotency-key'] || '')
      if (!/^[\w-]{16,80}$/.test(key)) throw new ReviewError(400, 'PROOF_REQUIRED', 'Missing submit key.')
      await runUpload(req, res)
      return reply(await flow.guardianResubmit(db, user, req.query.appointmentId, { reference: req.body?.reference, file: req.file?.buffer, key }))
    }
    // therapistRespond: req.body.action is accept | decline
    const out = await flow.therapistRespond(db, employee, user, req.body?.appointmentId, req.body || {})
    if (!out.already) await log(req.body.action === 'accept' ? 'appointment_accepted' : 'appointment_declined', out.appointment)
    return reply(out)
  } catch (err) {
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message, code: err.code })
    console.error(`booking-flow ${action}:`, err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
