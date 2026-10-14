// Support tickets, requester side (owner, therapist, patient/guardian). A user
// only ever sees their OWN tickets, and internal notes never leave the admin API.
//   POST /api/support/tickets                       new ticket (multipart: `data` JSON + optional `screenshot`)
//   GET  /api/support/tickets                       my tickets
//   GET  /api/support/tickets/:id                   one of mine, with its (non-internal) messages
//   POST /api/support/tickets/:id/messages          reply
//   GET  /api/support/attachments/:messageId/:index redirect to a 60-second signed URL (or {url} with ?json=1)
import multer from 'multer'
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import {
  CATEGORIES, MAX_IMAGE_BYTES, URGENT_WORDS, branchFor, cleanStr, createTicket, httpError, notifyUser, oidOrNull, pick, senderRoleOf,
  signedUrl, superAdmins, ticketRateOk, uploadScreenshot,
} from '../support.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single('screenshot')
const runUpload = (req, res) => new Promise((resolve, reject) => upload(req, res, (err) => (err ? reject(httpError(400, err.code === 'LIMIT_FILE_SIZE' ? 'Screenshots can be up to 5 MB.' : 'Could not read the screenshot.')) : resolve())))

const listShape = (t) => ({
  id: String(t._id), ticket_no: t.ticket_no, subject: t.subject, status: t.status, priority: t.priority, category: t.category,
  unread: !!t.unread_by_requester, last_message_at: t.last_message_at, created_at: t.ticket_created_at,
})

export default async function handler(req, res) {
  try {
    await getMongo()
    if (req.method === 'POST' && req.is('multipart/form-data') && !req.params?.id) await runUpload(req, res)
    const ctx = await requireSession(req, res, { roles: ['Owner', 'Therapist', 'Patient'], idle: false })
    if (!ctx) return
    const { db, user } = ctx
    const tickets = db.collection('support_tickets')
    const messages = db.collection('ticket_messages')
    const { id, messageId, index } = req.params || {}

    // ── Attachment ──────────────────────────────────────────────────────
    if (messageId) {
      const mid = oidOrNull(messageId)
      const msg = mid && await messages.findOne({ _id: mid, is_internal: false })
      const t = msg && await tickets.findOne({ _id: msg.ticket_id, requester_id: user._id })
      const file = msg?.attachments?.[Number(index)]
      if (!t || !file) throw httpError(404, 'Attachment not found.')
      const url = await signedUrl(file.file_path)
      if (req.query.json) return res.status(200).json({ url, file_name: file.file_name, file_type: file.file_type })
      return res.redirect(302, url)
    }

    // ── List / create ───────────────────────────────────────────────────
    if (!id) {
      if (req.method === 'GET') {
        const rows = await tickets.find({ requester_id: user._id }).sort({ last_message_at: -1 }).limit(100).toArray()
        return res.status(200).json({ tickets: rows.map(listShape), unread: rows.filter((t) => t.unread_by_requester).length })
      }
      if (req.method !== 'POST') throw httpError(405, 'Method not allowed')
      let body
      try { body = req.is('multipart/form-data') ? JSON.parse(String(req.body?.data || '{}')) : (req.body || {}) } catch { throw httpError(400, 'Could not read the ticket.') }
      const category = pick(body.category, CATEGORIES, null)
      const subject = cleanStr(body.subject, 150)
      const message = cleanStr(body.message, 5000)
      const fields = {}
      if (!category) fields.category = 'Choose a category.'
      if (!subject) fields.subject = 'Add a short subject.'
      if (!message) fields.message = 'Tell us what happened.'
      if (Object.keys(fields).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields })
      if (!(await ticketRateOk(db, user._id))) return res.status(429).json({ error: 'You have sent 5 tickets in the last hour. Please wait a bit, or reply on an existing ticket.' })

      const c = body.context && typeof body.context === 'object' ? body.context : {}
      const context = {
        page: cleanStr(c.page, 200).startsWith('/') ? cleanStr(c.page, 200) : '', browser: cleanStr(c.browser, 60), os: cleanStr(c.os, 60), app_version: cleanStr(c.app_version, 30),
      }
      const type = user.role === 'Owner' && ['game_request', 'branch'].includes(category) ? 'owner_request' : 'concern'
      const priority = category === 'bug' && URGENT_WORDS.test(`${subject} ${message}`) ? 'urgent' : ['billing', 'bug'].includes(category) ? 'high' : 'normal'
      const ticketId = new ObjectId()
      const attachments = req.file ? [await uploadScreenshot(String(ticketId), req.file)] : []
      const ticket = await createTicket(db, {
        user, category, subject, message, priority, type, source: pick(body.source, ['faq_bot', 'help_page'], 'help_page'),
        context: context.page || context.browser ? context : undefined, branchId: await branchFor(db, user), attachments, ticketId,
      })
      return res.status(201).json({ ticket_no: ticket.ticket_no, _id: String(ticket._id) })
    }

    // ── One of my tickets ───────────────────────────────────────────────
    const tid = oidOrNull(id)
    const t = tid && await tickets.findOne({ _id: tid, requester_id: user._id })
    if (!t) throw httpError(404, 'Ticket not found.')

    if (req.method === 'GET') {
      const rows = await messages.find({ ticket_id: tid, is_internal: false }).sort({ message_created_at: 1 }).toArray()
      if (t.unread_by_requester) await tickets.updateOne({ _id: tid }, { $set: { unread_by_requester: false } })
      return res.status(200).json({
        ticket: { ...listShape(t), unread: false, source: t.source || null, context: t.context || null },
        messages: rows.map((m) => ({
          id: String(m._id), from: m.sender_role === 'super_admin' ? 'support' : 'me', sender_role: m.sender_role, body: m.body, created_at: m.message_created_at,
          attachments: (m.attachments || []).map((a, i) => ({ index: i, file_name: a.file_name, file_type: a.file_type })),
        })),
      })
    }

    if (req.method === 'POST') {
      const body = cleanStr(req.body?.body, 5000)
      if (!body) throw httpError(400, 'Write a message first.')
      if (t.status === 'closed') throw httpError(409, 'This ticket is closed. Please open a new ticket.')
      const now = new Date()
      await messages.insertOne({ ticket_id: tid, sender_id: user._id, sender_role: senderRoleOf(user), body, is_internal: false, message_created_at: now })
      await tickets.updateOne({ _id: tid }, { $set: { unread_by_admin: true, last_message_at: now, ticket_updated_at: now, ...(t.status === 'resolved' ? { status: 'open', resolved_at: null } : {}) } })
      for (const a of await superAdmins(db)) await notifyUser(db, { email: a.email, name: a.full_name, title: `New reply on ${t.ticket_no}`, body: t.subject, link: `/admin/support-tickets?ticket=${t._id}`, ticketId: tid })
      return res.status(201).json({ ok: true })
    }
    throw httpError(405, 'Method not allowed')
  } catch (err) {
    console.error('support error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.', code: err.code })
  }
}
