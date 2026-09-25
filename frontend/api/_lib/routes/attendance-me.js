import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { Attendance } from '../models/attendance.js'
import '../models/branch.js'

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

// GET /api/attendance/me?email=... -> a therapist's own attendance log +
// this-month summary, for the "My Attendance" tab on their dashboard. Ported
// from backend/routes/attendance.js (GET /me).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).populate('branch_id', 'branch_name')
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const events = await Attendance.find({ employee: employee._id, is_archived: { $ne: true } })
      .sort({ scanned_at: 1 })
      .limit(1000)
      .lean()

    const byDay = new Map()
    for (const ev of events) {
      const key = dateKeyOf(ev.scanned_at)
      if (!byDay.has(key)) byDay.set(key, { date: key, timeIn: null, timeOut: null })
      const bucket = byDay.get(key)
      if (ev.type === 'time_in') {
        if (!bucket.timeIn) bucket.timeIn = ev.scanned_at
      } else if (ev.type === 'time_out') {
        bucket.timeOut = ev.scanned_at
      }
    }
    const dayRecords = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90)

    const monthPrefix = todayStamp().slice(0, 7)
    let daysThisMonth = 0
    let hoursThisMonth = 0
    for (const r of dayRecords) {
      if (!r.date.startsWith(monthPrefix)) continue
      daysThisMonth += 1
      if (r.timeIn && r.timeOut) {
        hoursThisMonth += (new Date(r.timeOut) - new Date(r.timeIn)) / 3600000
      }
    }

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    return res.status(200).json({
      employee: {
        name,
        specialty: employee.specialty || employee.position || '',
        branch: employee.branch_id?.branch_name || '',
      },
      summary: {
        daysThisMonth,
        hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
      },
      records: dayRecords,
    })
  } catch (err) {
    console.error('attendance/me error:', err)
    return res.status(500).json({ error: err.message || 'Could not load your attendance.' })
  }
}
