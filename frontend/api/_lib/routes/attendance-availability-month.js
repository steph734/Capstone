import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { TherapistAvailability } from '../models/therapistAvailability.js'

// GET /api/attendance/availability-month?email=...&month=YYYY-MM -> every
// therapist_availability record this therapist has for the given month —
// used to mark "Planned" days on the attendance calendar. Ported from
// backend/routes/attendance.js (GET /availability-month).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  const month = String(req.query.month || '').trim()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Invalid month.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email })
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const records = await TherapistAvailability.find({
      therapist: employee._id,
      date: { $gte: `${month}-01`, $lte: `${month}-31` },
      is_archived: { $ne: true },
    })
      .select('date status slots')
      .lean()

    return res.status(200).json({ records: records.map((r) => ({ date: r.date, status: r.status, slots: r.slots })) })
  } catch (err) {
    console.error('attendance/availability-month error:', err)
    return res.status(500).json({ error: err.message || 'Could not load this month’s availability.' })
  }
}
