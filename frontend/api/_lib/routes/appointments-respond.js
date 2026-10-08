import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { sendAppointmentStatusEmail } from '../appointmentEmail.js'

// PATCH /api/appointments/:id/respond  { action: 'accept' | 'decline' }
// The therapist confirmation modal on the Appointments page calls this once
// the therapist confirms. Sets the appointment's status, frees or keeps its
// slot, and emails the patient's registered address — matching behavior for
// accept and decline, as asked.
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) } catch { return '' }
}
function fmt12(t) {
  const [h, m] = String(t || '').split(':').map(Number)
  if (!Number.isFinite(h)) return ''
  const h12 = h % 12 || 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = String(req.params?.id || '')
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid appointment id.' })

  const action = String(req.body?.action || '')
  if (action !== 'accept' && action !== 'decline') {
    return res.status(400).json({ error: 'action must be "accept" or "decline".' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const _id = new mongoose.Types.ObjectId(id)

    const appt = await db.collection('appointments').findOne({ _id })
    if (!appt) return res.status(404).json({ error: 'Appointment not found.' })

    const nextStatus = action === 'accept' ? 'Confirmed' : 'Cancelled'
    const set = { status: nextStatus, updated_at: new Date() }
    if (action === 'decline') set.cancelled_reason = 'Declined by therapist'

    await db.collection('appointments').updateOne({ _id }, { $set: set })

    // Declining frees the slot it held, so another patient can book it.
    if (action === 'decline' && appt.employee_id && appt.session_date && appt.start_time) {
      const dateKey = new Date(appt.session_date).toISOString().slice(0, 10)
      await db.collection('therapist_availability').updateOne(
        { therapist: appt.employee_id, date: dateKey, slots: { $elemMatch: { appointment: _id } } },
        { $set: { 'slots.$.status': 'available', 'slots.$.appointment': null, updated_at: new Date() } }
      ).catch((err) => { console.error('appointments/respond: failed to free the availability slot:', err) })
    }

    let emailSent = false
    let emailError = null
    if (appt.contact_email) {
      try {
        await sendAppointmentStatusEmail({
          email: appt.contact_email,
          guardianName: appt.guardian_name,
          patient: appt.patient_name,
          therapist: appt.therapist_name,
          therapistRole: appt.therapist_role,
          dateStr: fmtDate(appt.session_date),
          timeStr: appt.start_time && appt.end_time ? `${fmt12(appt.start_time)} – ${fmt12(appt.end_time)}` : '',
          accepted: action === 'accept',
        })
        emailSent = true
      } catch (err) {
        emailError = err.message
        console.error('appointments/respond email error:', err)
      }
    }

    return res.status(200).json({ ok: true, status: nextStatus, emailSent, emailError })
  } catch (err) {
    console.error('appointments/respond error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the appointment.' })
  }
}
