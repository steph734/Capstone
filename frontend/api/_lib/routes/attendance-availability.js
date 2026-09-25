import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { Attendance } from '../models/attendance.js'
import { TherapistAvailability } from '../models/therapistAvailability.js'
import '../models/branch.js'

const CLINIC_TIMEZONE = 'Asia/Manila'
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
function todayStamp() {
  return dayKeyFormatter.format(new Date())
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// GET /api/attendance/availability?email=...&date=YYYY-MM-DD -> the same-day
// slots this therapist already answered for (confirmed or explicitly
// skipped), or `slots: null` if they haven't been asked yet.
//
// POST /api/attendance/availability -> upserts the slots a therapist opened
// up (status: 'confirmed'), or clears them (status: 'skipped'). Both ported
// from backend/routes/attendance.js so the "Set your availability" modal
// keeps writing to the `therapist_availability` collection on the deployed
// site without the local Express backend running.
export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req, res) {
  const email = String(req.query.email || '').trim().toLowerCase()
  const date = String(req.query.date || '').trim() || todayStamp()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email })
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const record = await TherapistAvailability.findOne({
      therapist: employee._id,
      date,
      is_archived: { $ne: true },
    }).lean()
    return res.status(200).json({
      date,
      status: record ? record.status : null,
      slots: record ? record.slots : null,
    })
  } catch (err) {
    console.error('attendance/availability GET error:', err)
    return res.status(500).json({ error: err.message || 'Could not load availability.' })
  }
}

async function handlePost(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const date = String(req.body?.date || '').trim() || todayStamp()
  const status = req.body?.status === 'skipped' ? 'skipped' : 'confirmed'
  const rawSlots = Array.isArray(req.body?.slots) ? req.body.slots : []
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  const submittedSlots = status === 'skipped'
    ? []
    : rawSlots
        .filter((s) => s && HHMM_RE.test(s.start) && HHMM_RE.test(s.end))
        .map((s) => ({ start: s.start, end: s.end, status: 'available', appointment: null }))

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).populate('branch_id', 'branch_name')
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const timeIn = await Attendance.findOne({
      employee: employee._id,
      type: 'time_in',
      is_archived: { $ne: true },
    }).sort({ scanned_at: -1 })

    // A slot a patient has already booked must survive this edit even if the
    // therapist's re-submitted selection dropped it (or they hit "Skip").
    const existing = await TherapistAvailability.findOne({ therapist: employee._id, date })
    const bookedSlots = (existing?.slots || []).filter((s) => s.status === 'booked')
    const bookedStarts = new Set(bookedSlots.map((s) => s.start))
    const slots = [...bookedSlots, ...submittedSlots.filter((s) => !bookedStarts.has(s.start))]

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')

    const record = await TherapistAvailability.findOneAndUpdate(
      { therapist: employee._id, date },
      {
        $set: {
          therapist_name: name,
          branch_id: employee.branch_id?._id || null,
          branch_name: employee.branch_id?.branch_name || null,
          timezone: CLINIC_TIMEZONE,
          attendance: timeIn?._id || null,
          slots,
          status,
          confirmed_at: status === 'confirmed' ? new Date() : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return res.status(200).json({ date, status: record.status, slots: record.slots })
  } catch (err) {
    console.error('attendance/availability POST error:', err)
    return res.status(500).json({ error: err.message || 'Could not save availability.' })
  }
}
