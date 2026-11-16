// Support ticket desk, Super Admin only (checked here on the server from the session).
//   GET   /api/admin/tickets?tab=&status=&category=&priority=&role=&q=&sort=&cursor=
//   GET   /api/admin/tickets/stats
//   GET   /api/admin/tickets/:id                  ticket + thread (incl. internal notes) + activity. :id = TCK-1001 or the ObjectId
//   PATCH /api/admin/tickets/:id                  { status?, priority?, assignedTo?, version }   (never to `resolved`)
//   POST  /api/admin/tickets/:id/replies          { body, internal } (JSON) or multipart: fields + one image `file`
//   PUT   /api/admin/tickets/:id/resolution-notes { text }   draft, not shown to the requester
//   POST  /api/admin/tickets/:id/resolve          { resolutionCode, resolutionNotes, version }
//   POST  /api/admin/tickets/:id/reopen           { version? }
// Every mutation answers with the full ticket detail so the client can replace its cache in one step.
// Internal notes live only in this API: the requester's API filters them out (see routes/support.js).
import multer from 'multer'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import {
  CATEGORIES, FAQ_ROLES, MAX_IMAGE_BYTES, PRIORITIES, cleanStr, httpError, notifyRequester, notifyUser, oidOrNull, pick, rateLimit, uploadScreenshot,
} from '../support.js'
import {
  ATTENTION_AFTER_DAYS, PRIORITY_RANK, RESOLUTION_CODES, TicketError, WORKFLOW_STATUSES, assertStatusChange, assertVersion, assertWritable,
  computeStats, isDone, parseListQuery, requireSuperAdmin, sortStage, validateResolution, versionOf,
} from '../ticketRules.js'

const PAGE = 20
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single('file')
const runUpload = (req, res) => new Promise((resolve, reject) => upload(req, res, (err) => (err ? reject(httpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'Attachments can be up to 5 MB.' : 'Could not read the attachment.')) : resolve())))

const lastSegment = (req) => String(req.path || req.url || '').split('?')[0].replace(/\/+$/, '').split('/').pop()

export default async function handler(req, res) {
  try {
    await getMongo()
    const action = lastSegment(req)
    const isStats = action === 'stats'
    // The sidebar badge polls stats; that must not keep an idle session alive.
    const ctx = await requireSession(req, res, { idle: !isStats })
    if (!ctx) return
    requireSuperAdmin(ctx.user) // anyone else gets 403 NOT_ALLOWED
    const { db, user, ip } = ctx
    const id = req.params?.id

    if (isStats) return res.status(200).json(await stats(db))
    if (!id) {
      if (req.method !== 'GET') throw httpError(405, 'Method not allowed')
      return res.status(200).json(await list(db, user._id, req.query))
    }

    const tickets = db.collection('support_tickets')
    const t = await findTicket(tickets, id)
    if (!t) throw new TicketError(404, 'NOT_ALLOWED', 'Ticket not found.')
    const actor = { _id: user._id, name: user.full_name || user.name || 'Super Admin' }

    if (req.method === 'GET' && !['replies', 'resolve', 'reopen', 'resolution-notes'].includes(action)) {
      if (t.unread_by_admin) await tickets.updateOne({ _id: t._id }, { $set: { unread_by_admin: false } })
      return res.status(200).json(await detail(db, user._id, t))
    }

    if (req.method === 'PATCH') {
      assertWritable(t)
      assertVersion(t, req.body?.version)
      const set = {}
      const events = []
      const b = req.body || {}
      if (b.status !== undefined) {
        if (typeof b.status !== 'string') throw new TicketError(400, 'INVALID_STATUS_TRANSITION', 'That status is not allowed.')
        if (b.status !== t.status) { assertStatusChange(t, b.status); set.status = b.status; set.unread_by_requester = true; events.push({ type: 'status', from: t.status, to: b.status }) }
      }
      if (b.priority !== undefined) {
        const p = pick(b.priority, PRIORITIES, null)
        if (!p) throw new TicketError(400, 'INVALID_STATUS_TRANSITION', 'That priority is not allowed.')
        if (p !== t.priority) { set.priority = p; events.push({ type: 'priority', from: t.priority, to: p }) }
      }
      if ('assignedTo' in b) {
        let a = null
        if (b.assignedTo) {
          a = oidOrNull(b.assignedTo)
          const adminUser = a && await db.collection('users').findOne({ _id: a, role: 'Super Admin', is_archived: { $ne: true } }, { projection: { full_name: 1 } })
          if (!adminUser) throw new TicketError(400, 'NOT_ALLOWED', 'Tickets can only be assigned to a Super Admin.')
          if (String(a) !== String(t.assigned_to)) events.push({ type: 'assigned', to: adminUser.full_name || 'Admin', self: String(a) === String(user._id) })
        } else if (t.assigned_to) events.push({ type: 'unassigned' })
        if (String(a || '') !== String(t.assigned_to || '')) set.assigned_to = a
      }
      if (!events.length) return res.status(200).json(await detail(db, user._id, t))
      set.ticket_updated_at = new Date()
      await tickets.updateOne({ _id: t._id }, { $set: set })
      await logEvents(db, t, actor, events)
      await audit(db, { user, action: 'ticket_update', ip, meta: { ticketNo: t.ticket_no, events: events.map((e) => e.type) } })
      const status = events.find((e) => e.type === 'status')
      if (status) await notifyRequester(db, t, `The status of your ticket ${t.ticket_no} changed to ${status.to.replace(/_/g, ' ')}.`)
      return res.status(200).json(await detail(db, user._id, await tickets.findOne({ _id: t._id })))
    }

    if (req.method === 'POST' && action === 'replies') {
      if (!rateLimit(`tk-reply:${user._id}`, 30, 60000)) throw new TicketError(429, 'NOT_ALLOWED', 'You are sending replies too quickly. Wait a moment and try again.')
      assertWritable(t)
      const body = cleanStr(req.body?.body, 5000)
      const internal = req.body?.internal === true || req.body?.internal === 'true'
      const file = req.file
      if (!body && !file) throw httpError(400, 'Write a message first.')
      const attachments = file ? [await uploadScreenshot(String(t._id), file)] : []
      const now = new Date()
      await db.collection('ticket_messages').insertOne({
        ticket_id: t._id, sender_id: user._id, sender_role: 'super_admin', body: body || '(attachment)', is_internal: internal,
        ...(attachments.length ? { attachments } : {}), message_created_at: now,
      })
      const set = { ticket_updated_at: now }
      if (!internal) { set.last_message_at = now; set.unread_by_requester = true; if (!t.first_response_at) set.first_response_at = now }
      await tickets.updateOne({ _id: t._id }, { $set: set })
      // The requester is told that there is a reply: never the text, never who wrote it. Internal notes notify nobody.
      if (!internal) await notifyRequester(db, t, `Support replied to your ticket ${t.ticket_no}. Open Help & Support to read it.`)
      await audit(db, { user, action: internal ? 'ticket_note' : 'ticket_reply', ip, meta: { ticketNo: t.ticket_no } })
      return res.status(201).json(await detail(db, user._id, await tickets.findOne({ _id: t._id })))
    }

    if (req.method === 'PUT' && action === 'resolution-notes') {
      assertWritable(t)
      const text = typeof req.body?.text === 'string' ? cleanStr(req.body.text.replace(/\r\n/g, '\n'), 5000) : null
      if (text === null) throw httpError(400, 'Invalid notes.')
      await tickets.updateOne({ _id: t._id }, { $set: { resolution_draft: text } })
      return res.status(200).json(await detail(db, user._id, await tickets.findOne({ _id: t._id })))
    }

    if (req.method === 'POST' && action === 'resolve') {
      const { code, notes } = validateResolution(req.body || {}, t)
      assertVersion(t, req.body?.version)
      const now = new Date()
      await tickets.updateOne({ _id: t._id }, {
        $set: {
          status: 'resolved', resolved_at: now, resolved_by: user._id, resolution_code: code, resolution_notes: notes, resolution_draft: '',
          ticket_updated_at: now, last_message_at: now, unread_by_requester: true, ...(t.first_response_at ? {} : { first_response_at: now }),
        },
      })
      // The notes become a public message, so the requester's existing ticket view shows the resolution (no change needed there).
      await db.collection('ticket_messages').insertOne({ ticket_id: t._id, sender_id: user._id, sender_role: 'super_admin', body: notes, is_internal: false, message_created_at: now })
      await logEvents(db, t, actor, [{ type: 'resolved', code }])
      await audit(db, { user, action: 'ticket_update', ip, meta: { ticketNo: t.ticket_no, resolved: code } })
      await notifyRequester(db, t, `Your ticket ${t.ticket_no} was resolved. Open Help & Support to read the resolution.`)
      return res.status(200).json(await detail(db, user._id, await tickets.findOne({ _id: t._id })))
    }

    if (req.method === 'POST' && action === 'reopen') {
      if (!isDone(t)) throw new TicketError(409, 'INVALID_STATUS_TRANSITION', 'Only a resolved ticket can be reopened.')
      if (req.body?.version !== undefined) assertVersion(t, req.body.version)
      const now = new Date()
      await tickets.updateOne({ _id: t._id }, { $set: { status: 'open', resolved_at: null, resolved_by: null, resolution_code: null, resolution_notes: null, ticket_updated_at: now } })
      await logEvents(db, t, actor, [{ type: 'reopened' }])
      await audit(db, { user, action: 'ticket_update', ip, meta: { ticketNo: t.ticket_no, reopened: true } })
      if (t.assigned_to && String(t.assigned_to) !== String(user._id)) {
        const a = await db.collection('users').findOne({ _id: t.assigned_to }, { projection: { email: 1, full_name: 1 } })
        if (a) await notifyUser(db, { email: a.email, name: a.full_name, title: `Ticket ${t.ticket_no} was reopened`, body: t.subject, link: `/admin/support-tickets/${t.ticket_no}`, ticketId: t._id })
      }
      return res.status(200).json(await detail(db, user._id, await tickets.findOne({ _id: t._id })))
    }

    throw httpError(405, 'Method not allowed')
  } catch (err) {
    if (err instanceof TicketError || err.status) {
      if (!(err instanceof TicketError) && err.status >= 500) console.error('admin/tickets error:', err)
      return res.status(err.status).json({ error: err.message, code: err.code })
    }
    console.error('admin/tickets error:', err)
    return res.status(500).json({ error: 'Could not complete that request.' })
  }
}

// Wrapper so multipart replies are parsed before the handler reads req.body.
export async function withUpload(req, res) {
  try {
    if (req.method === 'POST' && lastSegment(req) === 'replies' && req.is('multipart/form-data')) await runUpload(req, res)
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message })
  }
  return handler(req, res)
}

const findTicket = (tickets, id) => {
  const oid = oidOrNull(id)
  if (oid) return tickets.findOne({ _id: oid })
  if (/^TCK-\d{1,9}$/i.test(String(id))) return tickets.findOne({ ticket_no: String(id).toUpperCase() })
  return null
}

async function adminList(db, me) {
  const rows = await db.collection('users').find({ role: 'Super Admin', is_archived: { $ne: true } }, { projection: { full_name: 1 } }).toArray()
  return rows.map((a) => ({ id: String(a._id), name: a.full_name || 'Admin', isMe: String(a._id) === String(me) }))
}

async function stats(db) {
  const rows = await db.collection('support_tickets').find({}, { projection: { status: 1, ticket_created_at: 1, resolved_at: 1 } }).toArray()
  const s = computeStats(rows)
  return { openCount: s.openCount, oldestOpenMs: s.oldestOpenMs, resolvedCount: s.resolvedCount, averageAgeMs: s.averageAgeMs, waitingPastThreshold: s.waitingPastThreshold, attentionDays: ATTENTION_AFTER_DAYS }
}

async function list(db, me, query) {
  const { match, tab, sort, skip } = parseListQuery(query)
  const pageSize = Math.min(100, Math.max(PAGE, parseInt(query.limit, 10) || PAGE))
  const tickets = db.collection('support_tickets')
  const rankBranches = Object.entries(PRIORITY_RANK).map(([p, r]) => ({ case: { $eq: ['$priority', p] }, then: r }))
  const [rows, byType, admins] = await Promise.all([
    tickets.aggregate([
      { $match: tab ? { ...match, type: tab } : match },
      { $addFields: { priority_rank: { $switch: { branches: rankBranches, default: 9 } } } },
      { $sort: sortStage(sort) },
      { $skip: skip }, { $limit: pageSize + 1 },
      { $lookup: { from: 'users', localField: 'requester_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { full_name: 1 } }] } },
      { $lookup: { from: 'users', localField: 'assigned_to', foreignField: '_id', as: 'a', pipeline: [{ $project: { full_name: 1 } }] } },
      { $lookup: { from: 'branchs', localField: 'branch_id', foreignField: '_id', as: 'b', pipeline: [{ $project: { branch_name: 1 } }] } },
    ]).toArray(),
    tickets.aggregate([{ $match: match }, { $group: { _id: '$type', n: { $sum: 1 } } }]).toArray(),
    adminList(db, me),
  ])
  const t = Object.fromEntries(byType.map((x) => [x._id, x.n]))
  const page = rows.slice(0, pageSize)
  return {
    tickets: page.map((r) => ({
      id: String(r._id), number: r.ticket_no, subject: r.subject, status: r.status, priority: r.priority, category: r.category, type: r.type,
      requester: { name: r.u[0]?.full_name || null, role: r.requester_role, branch: r.b[0]?.branch_name || null },
      createdAt: r.ticket_created_at, updatedAt: r.ticket_updated_at, version: versionOf(r),
      assignedTo: r.assigned_to ? { id: String(r.assigned_to), name: r.a[0]?.full_name || 'Admin' } : null, unread: !!r.unread_by_admin,
    })),
    counts: { all: (t.owner_request || 0) + (t.concern || 0), owner_request: t.owner_request || 0, concern: t.concern || 0 },
    nextCursor: rows.length > pageSize ? String(skip + pageSize) : null,
    admins,
  }
}

async function logEvents(db, t, actor, events) {
  if (!events.length) return
  const at = new Date()
  await db.collection('ticket_activity').insertMany(events.map((e) => ({ ticket_id: t._id, actor_id: actor._id, actor_name: actor.name, ...e, created_at: at })))
}

async function detail(db, me, t) {
  const [msgs, requester, branch, activity, other, admins, resolver] = await Promise.all([
    db.collection('ticket_messages').find({ ticket_id: t._id }).sort({ message_created_at: 1 }).toArray(),
    db.collection('users').findOne({ _id: t.requester_id }, { projection: { full_name: 1, email: 1 } }),
    t.branch_id ? db.collection('branchs').findOne({ _id: t.branch_id }, { projection: { branch_name: 1 } }) : null,
    db.collection('ticket_activity').find({ ticket_id: t._id }).sort({ created_at: 1 }).toArray(),
    db.collection('support_tickets').countDocuments({ requester_id: t.requester_id, _id: { $ne: t._id } }),
    adminList(db, me),
    t.resolved_by ? db.collection('users').findOne({ _id: t.resolved_by }, { projection: { full_name: 1 } }) : null,
  ])
  const ids = [...new Set(msgs.map((m) => m.sender_id).filter(Boolean).map(String))].map((x) => oidOrNull(x)).filter(Boolean)
  const names = new Map((await db.collection('users').find({ _id: { $in: ids } }, { projection: { full_name: 1 } }).toArray()).map((u) => [String(u._id), u.full_name]))
  if (t.assigned_to && !admins.some((a) => a.id === String(t.assigned_to))) admins.push({ id: String(t.assigned_to), name: 'Former admin' })
  const requesterName = requester?.full_name || null
  const assigned = t.assigned_to ? admins.find((a) => a.id === String(t.assigned_to)) : null

  const timeline = [
    { type: 'opened', at: t.ticket_created_at, actor: requesterName || 'Unknown requester' },
    ...msgs.slice(1).map((m) => ({ type: m.is_internal ? 'note' : m.sender_role === 'super_admin' ? 'reply' : 'requester_reply', at: m.message_created_at, actor: names.get(String(m.sender_id)) || 'Unknown' })),
    ...activity.map((a) => ({ type: a.type, at: a.created_at, actor: a.actor_name, from: a.from, to: a.to, code: a.code, self: a.self })),
  ].sort((x, y) => new Date(x.at) - new Date(y.at))

  return {
    ticket: {
      id: String(t._id), number: t.ticket_no, subject: t.subject, status: t.status, priority: t.priority, category: t.category, type: t.type,
      source: t.source || null, context: t.context || null,
      assignedTo: assigned ? { id: assigned.id, name: assigned.name } : null,
      requester: { name: requesterName, email: requester?.email || null, role: t.requester_role, branch: branch?.branch_name || null, otherTickets: other },
      createdAt: t.ticket_created_at, updatedAt: t.ticket_updated_at, version: versionOf(t), firstResponseAt: t.first_response_at || null,
      resolvedAt: t.resolved_at || null, resolvedBy: resolver?.full_name || null,
      resolutionCode: t.resolution_code || null, resolutionNotes: t.resolution_notes || null, resolutionDraft: t.resolution_draft || '',
      unread: !!t.unread_by_admin,
    },
    messages: msgs.map((m) => ({
      id: String(m._id), author: m.sender_role === 'super_admin' ? (names.get(String(m.sender_id)) || 'Admin') : (requesterName || 'Unknown'),
      authorRole: m.sender_role, body: m.body, internal: !!m.is_internal, createdAt: m.message_created_at,
      attachments: (m.attachments || []).map((a, i) => ({ index: i, fileName: a.file_name, fileType: a.file_type })),
    })),
    activity: timeline,
    admins,
    config: { attentionAfterDays: ATTENTION_AFTER_DAYS, resolutionCodes: RESOLUTION_CODES, workflowStatuses: WORKFLOW_STATUSES, categories: CATEGORIES, roles: FAQ_ROLES },
  }
}
