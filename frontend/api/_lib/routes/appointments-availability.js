import mongoose from 'mongoose'
import { getDb } from '../mongo.js'

// GET /api/appointments/availability?year=2026&month=10[&employeeId=...]
// Reads the `appointments` collection (and the therapist's own slot list) for the month and answers, keyed the way the calendar keys
// its cells ("YYYY-M-D", M is 0-based):
//   booked  days that already have a LIVE booking (for the chosen therapist when employeeId is given, otherwise anyone's)
//   full    days where that therapist opened slots and none are left (only with employeeId)
// "Live" means a booking that really holds the slot: pending / confirmed / completed, not archived, and not a payment that failed,
// expired or was cancelled. An unpaid hold only counts until its hold runs out.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const year = Number(req.query.year)
  const month = Number(req.query.month) // 0-based, as the calendar keys it
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return res.status(400).json({ error: 'year and month query params are required.' })
  }
  const employeeRaw = String(req.query.employeeId || '').trim()
  if (employeeRaw && !mongoose.isValidObjectId(employeeRaw)) return res.status(400).json({ error: 'Invalid employeeId.' })
  const employeeId = employeeRaw ? new mongoose.Types.ObjectId(employeeRaw) : null

  try {
    const db = await getDb()
    const now = new Date()
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 1))

    // session_date is stored as Date.UTC(year, month, day) by the booking routes, so the UTC getters give the same calendar day back.
    const appointments = await db.collection('appointments')
      .find(
        {
          session_date: { $gte: start, $lt: end },
          status: { $in: ['Pending', 'Confirmed', 'Completed'] },
          is_archived: { $ne: true },
          ...(employeeId ? { employee_id: employeeId } : {}),
          $or: [
            { payment_state: { $nin: ['awaiting_payment', 'pending_verification', 'expired', 'failed', 'cancelled'] } }, // paid, cash, or older rows with no state
            { payment_state: { $in: ['awaiting_payment', 'pending_verification'] }, hold_expires_at: { $gt: now } }, // a hold that is still running
          ],
        },
        { projection: { session_date: 1 } },
      )
      .toArray()
    const keyOf = (d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    const booked = [...new Set(appointments.map((a) => keyOf(a.session_date)))]

    let full = []
    if (employeeId) {
      const pad = (n) => String(n).padStart(2, '0')
      const from = `${year}-${pad(month + 1)}-01`
      const to = `${month === 11 ? year + 1 : year}-${pad(((month + 1) % 12) + 1)}-01`
      const days = await db.collection('therapist_availability')
        .find({ therapist: employeeId, date: { $gte: from, $lt: to }, is_archived: { $ne: true } }, { projection: { date: 1, slots: 1 } })
        .toArray()
      full = days
        .filter((d) => Array.isArray(d.slots) && d.slots.length > 0 && d.slots.every((s) => s.status !== 'available'))
        .map((d) => { const [y, m, dd] = String(d.date).split('-').map(Number); return `${y}-${m - 1}-${dd}` })
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ booked, full })
  } catch (err) {
    console.error('appointments/availability error:', err)
    return res.status(500).json({ error: err.message || 'Could not load availability.' })
  }
}
