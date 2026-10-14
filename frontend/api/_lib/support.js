// Shared helpers for the Pao FAQ bot and the support-ticket system. Field names
// match the existing $jsonSchema validators on support_tickets, ticket_messages,
// faqs (snake_case); everything is written with the native driver.
import crypto from 'node:crypto'
import { ObjectId, Int32 } from 'mongodb'
import { getSupabaseAdmin } from './supabaseAdmin.js'
import { sendEmail } from './brevo.js'

export const BUCKET = 'support-attachments'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const CATEGORIES = ['game_request', 'branch', 'billing', 'bug', 'account', 'question', 'other']
export const STATUSES = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']
export const PRIORITIES = ['low', 'normal', 'high', 'urgent']
export const FAQ_CATEGORIES = ['appointments', 'notes', 'games', 'billing', 'account', 'messages', 'technical', 'other']
export const FAQ_ROLES = ['owner', 'therapist', 'patient', 'guardian']
export const OPEN_STATUSES = ['open', 'in_progress', 'waiting_on_user']

export const httpError = (status, message, code) => Object.assign(new Error(message), { status, code })

// App role -> the roles the support collections use. The app's "Patient"
// accounts are guardians signing in for their child.
export function supportRole(user) {
  if (user.role === 'Owner') return { requester_role: 'owner', faqRole: 'owner' }
  if (user.role === 'Therapist') return { requester_role: 'therapist', faqRole: 'therapist' }
  return { requester_role: 'guardian', faqRole: 'guardian' }
}
export const senderRoleOf = (user) => (user.role === 'Super Admin' ? 'super_admin' : supportRole(user).requester_role)

// ── Input cleaning: plain strings only, never objects (so no $-operators get through) ──
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
export const cleanStr = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(CTRL, '').trim().slice(0, max)
export const oidOrNull = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? new ObjectId(v) : null)
export const pick = (v, list, d) => (typeof v === 'string' && list.includes(v) ? v : d)
export const int32 = (n) => new Int32(Math.max(0, Math.floor(Number(n) || 0)))

// ── Rate limits ─────────────────────────────────────────────────────────────
// /faq/ask: 30 / minute / user, kept in memory (per server instance — enough to
// stop a runaway client; the durable limit below protects ticket creation).
const hits = new Map()
export function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (arr.length >= limit) { hits.set(key, arr); return false }
  arr.push(now); hits.set(key, arr)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
  return true
}
// Tickets: 5 / hour / user, counted from the database so it holds across instances.
export async function ticketRateOk(db, userId) {
  const n = await db.collection('support_tickets').countDocuments({ requester_id: userId, ticket_created_at: { $gte: new Date(Date.now() - 3600000) } })
  return n < 5
}

// ── Ticket numbers: TCK-<seq> from an atomic counter ────────────────────────
export async function nextTicketNo(db) {
  const r = await db.collection('counters').findOneAndUpdate({ _id: 'ticket_no' }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true })
  const doc = r && r.value !== undefined ? r.value : r // driver v5 returns the doc, older shapes { value }
  const seq = doc?.seq
  if (!seq) throw httpError(500, 'Could not create a ticket number.')
  return `TCK-${seq}`
}

// ── Branch for a requester (used on the ticket) ─────────────────────────────
export async function branchFor(db, user) {
  try {
    if (user.role === 'Therapist') return (await db.collection('employees').findOne({ email: String(user.email).toLowerCase() }, { projection: { branch_id: 1 } }))?.branch_id || null
    if (user.role === 'Patient') {
      const p = await db.collection('patients').findOne({ email: String(user.email).toLowerCase() }, { projection: { _id: 1 } })
      if (!p) return null
      const a = await db.collection('appointments').findOne({ patient_id: p._id, employee_id: { $ne: null } }, { sort: { created_at: -1 }, projection: { employee_id: 1 } })
      if (!a) return null
      return (await db.collection('employees').findOne({ _id: a.employee_id }, { projection: { branch_id: 1 } }))?.branch_id || null
    }
  } catch { /* a missing branch is fine */ }
  return null
}

// ── Private storage (Supabase, bucket "support-attachments") ────────────────
function magicOk(buf, type) {
  if (type === 'image/png') return buf.length > 8 && buf.subarray(0, 4).toString('hex') === '89504e47'
  if (type === 'image/jpeg') return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8
  if (type === 'image/webp') return buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP'
  if (type === 'image/gif') return buf.length > 6 && buf.subarray(0, 3).toString() === 'GIF'
  return false
}
export async function uploadScreenshot(ticketId, file) {
  if (!IMAGE_TYPES.includes(file.mimetype) || !magicOk(file.buffer, file.mimetype)) throw httpError(400, 'Attach a PNG, JPG, WebP or GIF image.')
  if (file.size > MAX_IMAGE_BYTES) throw httpError(400, 'Screenshots can be up to 5 MB.')
  let supabase
  try { supabase = getSupabaseAdmin() } catch { throw httpError(503, 'Screenshots are unavailable right now. You can still send the ticket without one.', 'NO_STORAGE') }
  const path = `tickets/${ticketId}/${crypto.randomUUID()}.${file.mimetype.split('/')[1].replace('jpeg', 'jpg')}`
  let { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimetype, upsert: false })
  if (error && /not found|bucket/i.test(error.message)) {
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})
    ;({ error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimetype, upsert: false }))
  }
  if (error) throw httpError(502, 'Could not store the screenshot. Please try again or send the ticket without it.')
  return { file_name: cleanStr(file.originalname, 255) || 'screenshot', file_path: path, file_type: file.mimetype, file_size: new Int32(file.size) }
}
export async function signedUrl(path) {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) throw httpError(502, 'Could not open the attachment.')
  return data.signedUrl
}

// ── Notifications (in-app doc + email) ──────────────────────────────────────
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const appBase = () => (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || 'https://therapypro.app'

export async function notifyUser(db, { email, name, title, body, link, type = 'support', emailIt = false, ticketId = null }) {
  if (!email) return
  await db.collection('notifications').insertOne({ recipient_email: String(email).toLowerCase(), type, title, body, link, request_id: ticketId, read: false, created_at: new Date() })
  if (!emailIt) return
  try {
    await sendEmail({
      to: email, toName: name || undefined, subject: title,
      html: `<div style="font-family:Arial,sans-serif;color:#2c4a3e;max-width:520px"><p>${name ? `Hi ${esc(name)},` : 'Hi,'}</p><p>${esc(body)}</p><p><a href="${appBase()}${link}" style="color:#234C40;font-weight:bold">Open TherapyPro</a></p></div>`,
      plain: `${name ? `Hi ${name},` : 'Hi,'}\n\n${body}\n\nOpen TherapyPro: ${appBase()}${link}\n`,
    })
  } catch (err) { console.error('support email failed:', err.message) }
}
export async function superAdmins(db) {
  return db.collection('users').find({ role: 'Super Admin', is_archived: { $ne: true } }, { projection: { email: 1, full_name: 1 } }).toArray()
}
// A new ticket: tell every Super Admin in-app; urgent ones are also emailed straight away.
export async function notifyNewTicket(db, ticket) {
  const admins = await superAdmins(db)
  for (const a of admins) {
    await notifyUser(db, {
      email: a.email, name: a.full_name, type: 'support',
      title: `${ticket.priority === 'urgent' ? 'Urgent ticket' : 'New ticket'} ${ticket.ticket_no}`,
      // Subject only: no message text, nothing clinical.
      body: `${ticket.subject}`, link: `/admin/support-tickets?ticket=${ticket._id}`,
      emailIt: ticket.priority === 'urgent', ticketId: ticket._id,
    })
  }
}
// The requester hears about replies / status changes — never the message content by email.
export async function notifyRequester(db, ticket, what) {
  const u = await db.collection('users').findOne({ _id: ticket.requester_id }, { projection: { email: 1, full_name: 1 } })
  if (!u) return
  await notifyUser(db, {
    email: u.email, name: u.full_name, type: 'support', title: `Your ticket ${ticket.ticket_no} was updated`,
    body: what, link: `/help?ticket=${ticket._id}`, emailIt: true, ticketId: ticket._id,
  })
}

// ── Ticket creation (shared by the user API and the auto-link from owner requests) ──
export async function createTicket(db, { user, category, subject, message, source, context, priority, type, relatedId = null, branchId, attachments = [], ticketId = null }) {
  const now = new Date()
  const _id = ticketId || new ObjectId()
  const ticket_no = await nextTicketNo(db)
  const { requester_role } = supportRole(user)
  const ticket = {
    _id, ticket_no, requester_id: user._id, requester_role, branch_id: branchId ?? null, type, category, subject, status: 'open', priority,
    assigned_to: null, related_id: relatedId, first_response_at: null, resolved_at: null, last_message_at: now,
    unread_by_admin: true, unread_by_requester: false, ticket_created_at: now, ticket_updated_at: now,
    ...(source ? { source } : {}), ...(context ? { context } : {}),
  }
  await db.collection('support_tickets').insertOne(ticket)
  await db.collection('ticket_messages').insertOne({
    ticket_id: _id, sender_id: user._id, sender_role: senderRoleOf(user), body: message, is_internal: false,
    ...(attachments.length ? { attachments } : {}), message_created_at: now,
  })
  notifyNewTicket(db, ticket).catch((e) => console.error('notify new ticket failed:', e.message))
  return ticket
}

export const BUG_WORDS = /\b(error|bug|blank|crash(es|ed|ing)?|not working|doesn'?t work|broken|ayaw|di mo-?load|d[ie] ?mo ?load|can'?t log ?in|cannot log ?in|payment failed|double charge[d]?|charged twice)\b/i
export const URGENT_WORDS = /(can'?t log ?in|cannot log ?in|payment|charged|charge|bayad|nabawas)/i
