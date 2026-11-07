// GET /api/payments/awaiting-verification: QR (GCash / Maya) payments waiting for THIS therapist to verify.
// Only the therapist who received the booking sees it (and the screenshot the patient attached, if any).
import { requireSession } from '../session.js'
import { employeeFor } from '../noteAccess.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
    if (!ctx) return
    const { db, user } = ctx
    const employee = await employeeFor(db, user)
    if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.' })

    const appointments = await db.collection('appointments').find({ employee_id: employee._id, payment_state: 'pending_verification' }).sort({ updated_at: -1 }).limit(50).toArray()
    const out = []
    for (const a of appointments) {
      const attempt = (await db.collection('payment_attempts').find({ appointment_id: a._id, status: 'pending_verification' }).sort({ created_at: -1 }).limit(1).toArray())[0]
      if (!attempt) continue
      out.push({
        attemptId: String(attempt._id), appointmentId: String(a._id), patient: a.patient_name, guardian: a.guardian_name, contact: a.contact_number,
        date: a.session_date, timeLabel: a.time_slot_label, amount: attempt.amount, currency: attempt.currency,
        method: attempt.method === 'paymaya' ? 'Maya QR' : 'GCash QR', reference: attempt.provider_ref || null,
        screenshot: attempt.qr_screenshot || null, submittedAt: attempt.qr_submitted_at || attempt.created_at,
      })
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ payments: out })
  } catch (err) {
    console.error('payments/awaiting error:', err)
    return res.status(500).json({ error: 'Could not load payments.' })
  }
}
