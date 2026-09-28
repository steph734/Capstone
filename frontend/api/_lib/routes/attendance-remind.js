import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { Attendance } from '../models/attendance.js'
import { sendAttendanceReminder } from '../attendanceReminderEmail.js'

// Same fixed clinic hours/timezone attendance-scan.js uses — there's no
// per-employee shift/schedule concept anywhere in this app yet, so every
// active staff member is assumed to work the same 8:00 AM–5:00 PM day.
const CLINIC_TIMEZONE = 'Asia/Manila'
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})
function todayStamp() {
  return dayKeyFormatter.format(new Date())
}

// GET /api/attendance/remind?type=time_in|time_out -> emails every active
// staff member who still needs the nudge, 5 minutes ahead of the clinic's
// fixed 8:00 AM (time_in) / 5:00 PM (time_out) shift edges. Hit on a
// schedule by Vercel Cron (see the two entries in vercel.json) rather than
// from the frontend, so it's locked behind CRON_SECRET rather than open to
// the public internet.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('attendance/remind: CRON_SECRET is not set — refusing to run.')
    return res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' })
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }

  const kind = req.query?.type === 'time_out' ? 'time_out' : 'time_in'

  try {
    await getMongo()
    const todayKey = todayStamp()

    const employees = await Employee.find({ status: 'active', email: { $exists: true, $ne: null, $ne: '' } })
      .select('first_name middle_name last_name email')
      .lean()

    const todaysScans = await Attendance.find({ attendance_date: todayKey, is_archived: { $ne: true } })
      .select('employee type')
      .lean()

    const timedInToday = new Set(todaysScans.filter((s) => s.type === 'time_in').map((s) => String(s.employee)))
    const timedOutToday = new Set(todaysScans.filter((s) => s.type === 'time_out').map((s) => String(s.employee)))

    const recipients = employees.filter((e) => {
      const id = String(e._id)
      // time_in reminder: skip anyone who's already clocked in today.
      // time_out reminder: only nudge people who clocked in but haven't left.
      return kind === 'time_in' ? !timedInToday.has(id) : timedInToday.has(id) && !timedOutToday.has(id)
    })

    const results = await Promise.allSettled(
      recipients.map((e) => sendAttendanceReminder({
        email: e.email,
        name: [e.first_name, e.last_name].filter(Boolean).join(' '),
        kind,
      }))
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - sent
    if (failed) {
      results.forEach((r, i) => { if (r.status === 'rejected') console.error(`attendance/remind: failed for ${recipients[i].email}:`, r.reason) })
    }

    return res.status(200).json({ kind, candidates: employees.length, sent, failed })
  } catch (err) {
    console.error('attendance/remind error:', err)
    return res.status(500).json({ error: err.message || 'Could not send attendance reminders.' })
  }
}
