// Support tickets, Super Admin side (Super Admin checked on the server).
//   GET   /api/admin/support/tickets?type=&status=&category=&priority=&role=&q=&page=&limit=
//   GET   /api/admin/support/stats
//   GET   /api/admin/support/tickets/:id               ticket + ALL messages (incl. internal notes)
//   POST  /api/admin/support/tickets/:id/messages      { body, is_internal }
//   PATCH /api/admin/support/tickets/:id               { status, priority, assigned_to }
//   GET   /api/admin/support/attachments/:messageId/:index   { url } a 60-second signed link
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { CATEGORIES, FAQ_ROLES, OPEN_STATUSES, PRIORITIES, STATUSES, cleanStr, httpError, notifyRequester, oidOrNull, pick, signedUrl } from '../support.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MIN = 60000

export default async function handler(req, res) {
  const { id } = req.params || {}
  const isStats = (req.path || '').endsWith('/stats')
  try {
    await getMongo()
    // The sidebar badge polls /stats every minute; that must not count as activity or an idle session would never lock.
    const ctx = await requireSession(req, res, { roles: ['Super Admin'], idle: !isStats })
    if (!ctx) return
    const { db, user, ip } = ctx
    const tickets = db.collection('support_tickets')
    const messages = db.collection('ticket_messages')

    // ── Attachment (signed link, 60 seconds) ──
    if (req.params?.messageId) {
      const mid = oidOrNull(req.params.messageId)
      const msg = mid && await messages.findOne({ _id: mid })
      const file = msg?.attachments?.[Number(req.params.index)]
      if (!file) throw httpError(404, 'Attachment not found.')
      return res.status(200).json({ url: await signedUrl(file.file_path), file_name: file.file_name, file_type: file.file_type })
    }

    // ── Stats ───────────────────────────────────────────────────────────
    if (isStats) {
      const weekAgo = new Date(Date.now() - 7 * 86400000)
      const [open, urgent, owner, unread, responded, resolved] = await Promise.all([
        tickets.countDocuments({ status: { $in: OPEN_STATUSES } }),
        tickets.countDocuments({ status: { $in: OPEN_STATUSES }, priority: 'urgent' }),
        tickets.countDocuments({ status: { $in: OPEN_STATUSES }, type: 'owner_request' }),
        tickets.countDocuments({ unread_by_admin: true, status: { $ne: 'closed' } }),
        tickets.find({ first_response_at: { $ne: null } }, { projection: { ticket_created_at: 1, first_response_at: 1 } }).sort({ ticket_created_at: -1 }).limit(200).toArray(),
        tickets.find({ resolved_at: { $gte: weekAgo } }, { projection: { ticket_created_at: 1, resolved_at: 1 } }).toArray(),
      ])
      const avg = (rows, a, b) => (rows.length ? Math.round(rows.reduce((s, r) => s + (r[b] - r[a]), 0) / rows.length / MIN) : null)
      return res.status(200).json({ open, urgent, openOwnerRequests: owner, unread, avgFirstResponseMinutes: avg(responded, 'ticket_created_at', 'first_response_at'), resolvedThisWeek: resolved.length, avgResolveMinutes: avg(resolved, 'ticket_created_at', 'resolved_at') })
    }

    // ── List ────────────────────────────────────────────────────────────
    if (!id) {
      if (req.method !== 'GET') throw httpError(405, 'Method not allowed')
      const q = req.query
      const match = {}
      const type = pick(q.type, ['owner_request', 'concern'], null); if (type) match.type = type
      const status = pick(q.status, [...STATUSES, 'open_all'], null); if (status) match.status = status === 'open_all' ? { $in: OPEN_STATUSES } : status
      const category = pick(q.category, CATEGORIES, null); if (category) match.category = category
      const priority = pick(q.priority, PRIORITIES, null); if (priority) match.priority = priority
      const role = pick(q.role, FAQ_ROLES, null); if (role) match.requester_role = role
      const needle = cleanStr(q.q, 80)
      if (needle) match.$or = [{ subject: { $regex: esc(needle), $options: 'i' } }, { ticket_no: { $regex: esc(needle.toUpperCase()) } }]
      const limit = Math.min(50, Math.max(1, Number(q.limit) || 20))
      const page = Math.max(1, Number(q.page) || 1)

      const [rows, total, byType, byStatus, admins] = await Promise.all([
        tickets.aggregate([
          { $match: match },
          { $addFields: { pr: { $cond: [{ $eq: ['$priority', 'urgent'] }, 0, 1] } } },
          { $sort: { pr: 1, last_message_at: -1 } },
          { $skip: (page - 1) * limit }, { $limit: limit },
          { $lookup: { from: 'users', localField: 'requester_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { full_name: 1, email: 1 } }] } },
          { $lookup: { from: 'branchs', localField: 'branch_id', foreignField: '_id', as: 'b', pipeline: [{ $project: { branch_name: 1 } }] } },
          { $lookup: { from: 'ticket_messages', localField: '_id', foreignField: 'ticket_id', as: 'last', pipeline: [{ $sort: { message_created_at: -1 } }, { $limit: 1 }, { $project: { body: 1, sender_role: 1, is_internal: 1 } }] } },
        ]).toArray(),
        tickets.countDocuments(match),
        tickets.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]).toArray(),
        tickets.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
        db.collection('users').find({ role: 'Super Admin', is_archived: { $ne: true } }, { projection: { full_name: 1 } }).toArray(),
      ])
      const t = Object.fromEntries(byType.map((x) => [x._id, x.n]))
      return res.status(200).json({
        total, page, limit,
        counts: { all: (t.owner_request || 0) + (t.concern || 0), owner_request: t.owner_request || 0, concern: t.concern || 0, status: Object.fromEntries(byStatus.map((x) => [x._id, x.n])) },
        admins: admins.map((a) => ({ id: String(a._id), name: a.full_name })),
        tickets: rows.map((r) => ({
          id: String(r._id), ticket_no: r.ticket_no, subject: r.subject, status: r.status, priority: r.priority, category: r.category, type: r.type, source: r.source || null,
          requester: { name: r.u[0]?.full_name || 'Unknown', email: r.u[0]?.email || '', role: r.requester_role }, branch: r.b[0]?.branch_name || null,
          preview: r.last[0] ? `${r.last[0].is_internal ? 'Internal note: ' : ''}${String(r.last[0].body).slice(0, 110)}` : '', last_sender: r.last[0]?.sender_role || null,
          last_message_at: r.last_message_at, created_at: r.ticket_created_at, unread: !!r.unread_by_admin, assigned_to: r.assigned_to ? String(r.assigned_to) : null,
        })),
      })
    }

    // ── One ticket ──────────────────────────────────────────────────────
    const tid = oidOrNull(id)
    const t = tid && await tickets.findOne({ _id: tid })
    if (!t) throw httpError(404, 'Ticket not found.')

    if (req.method === 'GET') {
      const [rows, u, b] = await Promise.all([
        messages.find({ ticket_id: tid }).sort({ message_created_at: 1 }).toArray(),
        db.collection('users').findOne({ _id: t.requester_id }, { projection: { full_name: 1, email: 1 } }),
        t.branch_id ? db.collection('branchs').findOne({ _id: t.branch_id }, { projection: { branch_name: 1 } }) : null,
      ])
      if (t.unread_by_admin) await tickets.updateOne({ _id: tid }, { $set: { unread_by_admin: false } })
      const names = new Map((await db.collection('users').find({ _id: { $in: [...new Set(rows.map((m) => m.sender_id))] } }, { projection: { full_name: 1 } }).toArray()).map((x) => [String(x._id), x.full_name]))
      return res.status(200).json({
        ticket: {
          id: String(t._id), ticket_no: t.ticket_no, subject: t.subject, status: t.status, priority: t.priority, category: t.category, type: t.type, source: t.source || null,
          context: t.context || null, related_id: t.related_id ? String(t.related_id) : null, assigned_to: t.assigned_to ? String(t.assigned_to) : null,
          requester: { name: u?.full_name || 'Unknown', email: u?.email || '', role: t.requester_role }, branch: b?.branch_name || null,
          created_at: t.ticket_created_at, first_response_at: t.first_response_at, resolved_at: t.resolved_at,
        },
        messages: rows.map((m) => ({ id: String(m._id), sender: names.get(String(m.sender_id)) || 'Unknown', sender_role: m.sender_role, body: m.body, is_internal: m.is_internal, created_at: m.message_created_at, attachments: (m.attachments || []).map((a, i) => ({ index: i, file_name: a.file_name, file_type: a.file_type })) })),
      })
    }

    if (req.method === 'POST' && (req.path || '').endsWith('/messages')) {
      const body = cleanStr(req.body?.body, 5000)
      if (!body) throw httpError(400, 'Write a message first.')
      const internal = req.body?.is_internal === true
      const now = new Date()
      await messages.insertOne({ ticket_id: tid, sender_id: user._id, sender_role: 'super_admin', body, is_internal: internal, message_created_at: now })
      const set = { ticket_updated_at: now }
      if (!internal) {
        set.last_message_at = now; set.unread_by_requester = true
        if (!t.first_response_at) set.first_response_at = now
      }
      await tickets.updateOne({ _id: tid }, { $set: set })
      if (!internal) await notifyRequester(db, t, `An admin replied to your ticket ${t.ticket_no}. Open Help & Support to read it.`)
      await audit(db, { user, action: internal ? 'ticket_note' : 'ticket_reply', ip, meta: { ticketNo: t.ticket_no } })
      return res.status(201).json({ ok: true })
    }

    if (req.method === 'PATCH') {
      const set = {}
      const changes = {}
      const status = pick(req.body?.status, STATUSES, null)
      if (status && status !== t.status) { set.status = status; changes.status = status; set.resolved_at = status === 'resolved' ? new Date() : (status === 'closed' ? t.resolved_at || new Date() : null) }
      const priority = pick(req.body?.priority, PRIORITIES, null)
      if (priority && priority !== t.priority) { set.priority = priority; changes.priority = priority }
      if ('assigned_to' in (req.body || {})) {
        const a = req.body.assigned_to === null || req.body.assigned_to === '' ? null : oidOrNull(req.body.assigned_to)
        if (req.body.assigned_to && !a) throw httpError(400, 'Invalid assignee.')
        if (a && !(await db.collection('users').findOne({ _id: a, role: 'Super Admin' }, { projection: { _id: 1 } }))) throw httpError(400, 'Tickets can only be assigned to a Super Admin.')
        if (String(a) !== String(t.assigned_to)) { set.assigned_to = a; changes.assigned_to = a ? String(a) : null }
      }
      if (!Object.keys(changes).length) return res.status(200).json({ ok: true, unchanged: true })
      set.ticket_updated_at = new Date()
      if (changes.status) set.unread_by_requester = true
      await tickets.updateOne({ _id: tid }, { $set: set })
      await audit(db, { user, action: 'ticket_update', ip, meta: { ticketNo: t.ticket_no, ...changes } })
      if (changes.status) await notifyRequester(db, t, `The status of your ticket ${t.ticket_no} changed to ${changes.status.replace('_', ' ')}.`)
      return res.status(200).json({ ok: true, changes })
    }
    throw httpError(405, 'Method not allowed')
  } catch (err) {
    console.error('admin/support error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
