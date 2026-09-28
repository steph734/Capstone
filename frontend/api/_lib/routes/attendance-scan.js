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
const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function dateKeyOf(d) {
  return dayKeyFormatter.format(new Date(d))
}

function todayStamp() {
  return dateKeyOf(new Date())
}

function clockOf(d) {
  return clockFormatter.format(new Date(d))
}

// Every card this app prints encodes "BRICKPATH-<employee_id>", not the bare
// employee_id — so a barcode from some other card, product, or forgery
// attempt (which won't carry this prefix) is rejected before it ever reaches
// the database lookup. See drawBarcode() in OwnerStaffPage.jsx, the only
// place a scannable badge is generated.
const BRICKPATH_PREFIX = 'BRICKPATH-'

// A scan within this many minutes of the employee's own last scan is treated
// as an accidental duplicate (camera re-triggering, badge held up twice)
// rather than a deliberate time-out — see the check below.
const DUPLICATE_COOLDOWN_MS = 2 * 60 * 1000

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

  const raw = String(req.body?.employee_id || '').trim()
  if (!raw) {
    return res.status(400).json({ error: 'No badge code was provided.' })
  }

  if (!raw.startsWith(BRICKPATH_PREFIX)) {
    return res.status(422).json({
      error: "This isn't a valid BrickPath staff ID. Scan the barcode on a BrickPath ID card.",
      reason: 'invalid_badge',
    })
  }
  const code = raw.slice(BRICKPATH_PREFIX.length).trim()
  if (!code) {
    return res.status(422).json({
      error: "This isn't a valid BrickPath staff ID. Scan the barcode on a BrickPath ID card.",
      reason: 'invalid_badge',
    })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ employee_id: code }).populate('branch_id', 'branch_name')
    if (!employee) {
      return res.status(404).json({ error: `No staff member matches badge "${code}".` })
    }

    const now = new Date()
    const todayKey = todayStamp()
    // Every scan the employee made today, oldest first — not just the very
    // last scan ever — so a stray scan from a previous day never gets
    // mistaken for "already timed in today".
    const todaysScans = await Attendance.find({
      employee: employee._id,
      attendance_date: todayKey,
      is_archived: { $ne: true },
    }).sort({ scanned_at: 1 })

    const todaysTimeIn = todaysScans.find((s) => s.type === 'time_in') || null
    const todaysTimeOut = todaysScans.find((s) => s.type === 'time_out') || null

    if (todaysTimeIn && todaysTimeOut) {
      return res.status(409).json({
        error: `You've already logged attendance for today — Time In ${clockOf(todaysTimeIn.scanned_at)}, Time Out ${clockOf(todaysTimeOut.scanned_at)}.`,
        reason: 'completed',
      })
    }

    let type
    if (!todaysTimeIn) {
      type = 'time_in'
    } else {
      const sinceTimeIn = now.getTime() - new Date(todaysTimeIn.scanned_at).getTime()
      if (sinceTimeIn < DUPLICATE_COOLDOWN_MS) {
        return res.status(409).json({
          error: `You've already timed in today at ${clockOf(todaysTimeIn.scanned_at)}.`,
          reason: 'duplicate',
        })
      }
      type = 'time_out'
    }

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
