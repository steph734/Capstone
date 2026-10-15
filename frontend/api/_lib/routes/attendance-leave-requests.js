import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { LeaveRequest } from '../models/leaveRequest.js'
import '../models/branch.js'
import { getDb } from '../mongo.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const LEAVE_TYPES = ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Other']

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

// GET /api/attendance/leave-requests?email=... -> this therapist's own leave
// requests, most recent first.
// POST /api/attendance/leave-requests -> a therapist asks the owner for time
// off over a date range, created as 'pending'. Both ported from
// backend/routes/attendance.js.
export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req, res) {
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email })
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const requests = await LeaveRequest.find({ employee: employee._id, is_archived: { $ne: true } })
      .sort({ requested_at: -1 })
      .limit(100)
      .lean()

    return res.status(200).json({
      requests: requests.map((r) => ({
        id: r._id,
        leaveType: r.leave_type,
        startDate: dateKeyOf(r.start_date),
        endDate: dateKeyOf(r.end_date),
        reason: r.reason,
        status: r.status,
        requestedAt: r.requested_at,
        reviewNote: r.review_note || null,
        reviewedAt: r.reviewed_at || null,
      })),
    })
  } catch (err) {
    console.error('attendance/leave-requests GET error:', err)
    return res.status(500).json({ error: err.message || 'Could not load your leave requests.' })
  }
}

// In-app notice for the branch's owner(s). Best-effort: never fails the request.
async function notifyOwners(employee, name, doc, startDate, endDate) {
  try {
    const db = await getDb()
    const branch = await db.collection('branches').findOne({ _id: employee.branch_id?._id }, { projection: { owner_id: 1 } })
    const owners = branch?.owner_id ? await db.collection('users').find({ _id: branch.owner_id }).toArray() : await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }).toArray()
    const range = startDate === endDate ? startDate : startDate + ' to ' + endDate
    const docs = owners.filter((o) => o.email).map((o) => ({
      recipient_email: String(o.email).toLowerCase(), type: 'leave_request', title: 'New leave request',
      body: name + ' requested ' + doc.leave_type + ' (' + range + ').', link: '/owner/staff',
      request_id: doc._id, read: false, created_at: new Date(),
    }))
    if (docs.length) await db.collection('notifications').insertMany(docs)
  } catch (err) {
    console.error('leave request owner notice failed:', err.message)
  }
}

async function handlePost(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const leaveType = String(req.body?.leaveType || '').trim()
  const startDate = String(req.body?.startDate || '').trim()
  const endDate = String(req.body?.endDate || '').trim()
  const reason = req.body?.reason != null ? String(req.body.reason).trim() : ''

  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }
  if (!LEAVE_TYPES.includes(leaveType)) {
    return res.status(400).json({ error: 'Invalid leave type.' })
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return res.status(400).json({ error: 'Invalid date range.' })
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: 'End date must be on or after the start date.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).populate('branch_id', 'branch_name')
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    const doc = await LeaveRequest.create({
      employee: employee._id,
      employee_name: name,
      branch_id: employee.branch_id?._id || null,
      leave_type: leaveType,
      start_date: new Date(`${startDate}T00:00:00.000Z`),
      end_date: new Date(`${endDate}T00:00:00.000Z`),
      reason: reason || null,
      status: 'pending',
      requested_at: new Date(),
    })

    await notifyOwners(employee, name, doc, startDate, endDate)

    return res.status(201).json({
      id: doc._id,
      leaveType: doc.leave_type,
      startDate,
      endDate,
      reason: doc.reason,
      status: doc.status,
      requestedAt: doc.requested_at,
    })
  } catch (err) {
    console.error('attendance/leave-requests POST error:', err)
    return res.status(500).json({ error: err.message || 'Could not submit your leave request.' })
  }
}
