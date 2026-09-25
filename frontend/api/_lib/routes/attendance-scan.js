import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { Attendance } from '../models/attendance.js'
import '../models/branch.js'

// Calendar-day key, fixed to Philippine local time (the clinic's only
// timezone, which never observes DST) — see backend/routes/attendance.js for
// the fuller explanation. Ported here so this collection stays correct
// regardless of which timezone the serverless container itself runs in.
const CLINIC_TIMEZONE = 'Asia/Manila'
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dateKeyOf(d) {
  return dayKeyFormatter.format(new Date(d))
}

function todayStamp() {
  return dateKeyOf(new Date())
}

function initialsFromName(name) {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}

// POST /api/attendance/scan -> logs a time-in/time-out scan EVENT for the
// employee whose badge barcode was just decoded by the owner's webcam
// scanner. Ported from backend/routes/attendance.js (POST /scan) so this
// keeps working on the deployed site without the local Express backend.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = String(req.body?.employee_id || '').trim()
  if (!code) {
    return res.status(400).json({ error: 'No badge code was provided.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ employee_id: code }).populate('branch_id', 'branch_name')
    if (!employee) {
      return res.status(404).json({ error: `No staff member matches badge "${code}".` })
    }

    const now = new Date()
    const todayKey = todayStamp()
    const lastScan = await Attendance.findOne({ employee: employee._id, is_archived: { $ne: true } })
      .sort({ scanned_at: -1 })

    const type = (!lastScan || dateKeyOf(lastScan.scanned_at) !== todayKey || lastScan.type === 'time_out')
      ? 'time_in'
      : 'time_out'

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    await Attendance.create({
      employee: employee._id,
      employee_name: name,
      branch_id: employee.branch_id?._id || null,
      branch_name: employee.branch_id?.branch_name || null,
      scanned_at: now,
      attendance_date: todayKey,
      timezone: CLINIC_TIMEZONE,
      type,
      source: 'webcam',
    })

    return res.status(200).json({
      name,
      initials: initialsFromName(name),
      specialty: employee.specialty || employee.position || '',
      branch: employee.branch_id?.branch_name || '',
      type: type === 'time_in' ? 'Time In' : 'Time Out',
      loggedAt: now,
    })
  } catch (err) {
    console.error('attendance/scan error:', err)
    return res.status(500).json({ error: err.message || 'Could not log attendance. Please try again.' })
  }
}
