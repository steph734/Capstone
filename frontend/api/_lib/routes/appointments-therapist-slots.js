import mongoose from 'mongoose'
import { getDb } from '../mongo.js'

// GET /api/appointments/therapist-slots?employeeId=...&date=YYYY-MM-DD -> the
// same-day time slots that therapist confirmed after clocking in (see
// backend/routes/attendance.js POST/GET /api/attendance/availability, which
// writes to this same `therapist_availability` collection from the Express
// API). `slots: null` means they haven't answered for that day yet — the
// booking page falls back to the default slot list in that case, since for
// any date besides today the therapist won't have clocked in yet to answer.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const employeeId = String(req.query.employeeId || '').trim()
  const date = String(req.query.date || '').trim()
  if (!employeeId || !date) {
    return res.status(400).json({ error: 'employeeId and date query params are required.' })
  }
  if (!mongoose.isValidObjectId(employeeId)) {
    return res.status(400).json({ error: 'Invalid employeeId.' })
  }

  try {
    const db = await getDb()
    const record = await db.collection('therapist_availability').findOne({
      employee: new mongoose.Types.ObjectId(employeeId),
      date,
    })
    return res.status(200).json({ date, slots: record ? record.slots : null })
  } catch (err) {
    console.error('appointments/therapist-slots error:', err)
    return res.status(500).json({ error: err.message || 'Could not load availability.' })
  }
}
