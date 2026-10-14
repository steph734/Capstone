// Owner side of therapist leave requests.
//   GET   /api/owner/leave-requests            -> pending requests (+ recent decisions)
//   PATCH /api/owner/leave-requests?id=<id>    { action: 'approve' | 'reject', note? }
// The caller is the signed-in Owner (server session), never an email from the
// browser. A decision is final, audited, and notifies the therapist.
import { ObjectId } from 'mongodb'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { sendEmail } from '../brevo.js'

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const dayKey = (d) => new Date(d).toISOString().slice(0, 10)
const dayCount = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1

// Branches this owner runs. An owner with no branch assigned yet sees every
// request, matching how the rest of the owner Staff page behaves.
async function branchScope(db, user) {
  const owned = await db.collection('branches').find({ owner_id: user._id }, { projection: { _id: 1 } }).toArray()
  return owned.length ? { branch_id: { $in: owned.map((b) => b._id) } } : {}
}

function serialize(r, emp) {
  return {
    id: String(r._id),
    employeeId: r.employee ? String(r.employee) : null,
    name: r.employee_name || '',
    specialty: emp?.specialty || null,
    leaveType: r.leave_type,
    startDate: dayKey(r.start_date),
    endDate: dayKey(r.end_date),
    days: dayCount(r.start_date, r.end_date),
    reason: r.reason || '',
    status: r.status,
    requestedAt: r.requested_at,
    reviewNote: r.review_note || null,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const ctx = await requireSession(req, res, { roles: ['Owner'] })
  if (!ctx) return
  const { db, user, ip } = ctx

  try {
    const scope = await branchScope(db, user)
    const col = db.collection('leave_request')

    if (req.method === 'GET') {
      const rows = await col
        .find({ ...scope, is_archived: { $ne: true } })
        .sort({ requested_at: -1 })
        .limit(100)
        .toArray()
      const emps = await db.collection('employees')
        .find({ _id: { $in: rows.map((r) => r.employee).filter(Boolean) } }, { projection: { specialty: 1 } })
        .toArray()
      const byId = new Map(emps.map((e) => [String(e._id), e]))
      const all = rows.map((r) => serialize(r, byId.get(String(r.employee))))
      return res.status(200).json({
        pending: all.filter((r) => r.status === 'pending').reverse(),
        recent: all.filter((r) => r.status !== 'pending').slice(0, 20),
      })
    }

    const action = req.body?.action
    const note = String(req.body?.note || '').trim().slice(0, 500)
    if (action !== 'approve' && action !== 'reject') return res.status(400).json({ error: 'Choose approve or reject.' })
    if (!ObjectId.isValid(String(req.query.id || ''))) return res.status(400).json({ error: 'Invalid request id.' })
    if (action === 'reject' && !note) return res.status(400).json({ error: 'Please give the therapist a short reason for declining.' })

    const status = action === 'approve' ? 'approved' : 'rejected'
    // Only a still-pending request in this owner's scope can be decided, so a
    // double-click or a second owner can't flip an existing decision.
    const upd = await col.findOneAndUpdate(
      { _id: new ObjectId(String(req.query.id)), status: 'pending', ...scope },
      { $set: { status, reviewed_by: user._id, review_note: note || null, reviewed_at: new Date(), updated_at: new Date() } },
      { returnDocument: 'after' },
    )
    const doc = upd?.value !== undefined ? upd.value : upd
    if (!doc) return res.status(409).json({ error: 'This request was already decided or no longer exists.' })

    await audit(db, { user, action: `leave_${status}`, ip, meta: { leave_request_id: String(doc._id), employee_id: doc.employee ? String(doc.employee) : null } })

    // Tell the therapist. Best-effort: a failed email never undoes the decision.
    const emp = doc.employee ? await db.collection('employees').findOne({ _id: doc.employee }) : null
    if (emp?.email) {
      const range = doc.start_date.getTime() === doc.end_date.getTime() ? dayKey(doc.start_date) : `${dayKey(doc.start_date)} to ${dayKey(doc.end_date)}`
      const title = action === 'approve' ? 'Your leave request was approved' : 'Your leave request was declined'
      const body = `${doc.leave_type} (${range}) was ${status === 'approved' ? 'approved' : 'declined'}.${note ? ` Note: ${note}` : ''}`
      await db.collection('notifications').insertOne({
        recipient_email: emp.email.toLowerCase(), type: 'leave_request', title, body, link: '/therapist/attendance',
        request_id: doc._id, read: false, created_at: new Date(),
      })
      try {
        await sendEmail({
          to: emp.email, toName: doc.employee_name, subject: title,
          html: `<div style="font-family:Arial,sans-serif;color:#2c4a3e;max-width:520px"><p>Hi ${esc(doc.employee_name)},</p><p>${esc(body)}</p></div>`,
          plain: `Hi ${doc.employee_name},\n\n${body}\n`,
        })
      } catch (err) {
        console.error('leave decision email failed:', err.message)
      }
    }
    return res.status(200).json({ request: serialize(doc, emp) })
  } catch (err) {
    console.error('owner/leave-requests error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not process leave requests.' })
  }
}
