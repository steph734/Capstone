// Shared server helpers for owner "Request a Game" (game_requests collection),
// the Super Admin side that answers them, and the owner notifications those
// answers create (in-app `notifications` doc + a Brevo email).
import mongoose from 'mongoose'
import { getDb } from './mongo.js'
import { sendEmail } from './brevo.js'

export const SKILLS = ['speech', 'cognitive', 'sel', 'gross_motor', 'fine_motor']
export const SKILL_LABEL = { speech: 'Speech & language', cognitive: 'Cognitive', sel: 'Attention / SEL', gross_motor: 'Gross motor', fine_motor: 'Fine motor' }
// Request skill -> the therapy type the Super Admin "Add game" form expects.
export const SKILL_THERAPY_TYPE = { speech: 'Speech', cognitive: 'Cognitive', sel: 'Cognitive', gross_motor: 'Physical', fine_motor: 'Occupational' }
export const STATUS_LABEL = { pending: 'Pending review', approved: 'Approved', dev: 'In development', live: 'Live', declined: 'Declined', withdrawn: 'Withdrawn' }
export const PRIORITIES = ['low', 'medium', 'high']
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

// No session/token auth anywhere in this app, so (like every other route) the
// caller is identified by the login email; this verifies it belongs to an
// active, non-archived user with one of the allowed roles.
export async function requireRole(req, res, roles) {
  const email = String((req.method === 'GET' ? req.query.email : req.body?.email) || '').trim().toLowerCase()
  if (!email) { res.status(400).json({ error: 'Missing email.' }); return null }
  const db = await getDb()
  const user = await db.collection('users').findOne({ email, role: { $in: roles }, is_archived: { $ne: true } })
  if (!user) { res.status(403).json({ error: `Only ${roles.join(' / ')} accounts can do this.` }); return null }
  return { db, user }
}

export function oid(id) {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null
}

// Validates + normalises the request form (also used for edits).
export function validateRequestInput(body) {
  const errors = {}
  const name = String(body.name || '').trim()
  if (!name) errors.name = 'Give the game a name or a short idea.'
  else if (name.length > 80) errors.name = 'Keep the name to 80 characters.'
  const skill = String(body.skill || '')
  if (!SKILLS.includes(skill)) errors.skill = 'Pick a skill focus.'
  const ageMin = Number(body.ageMin)
  const ageMax = Number(body.ageMax)
  if (!Number.isInteger(ageMin) || ageMin < 2 || ageMin > 18) errors.ageMin = 'Enter a start age between 2 and 18.'
  if (!Number.isInteger(ageMax) || ageMax < 2 || ageMax > 18) errors.ageMax = 'Enter an end age between 2 and 18.'
  if (!errors.ageMin && !errors.ageMax && ageMin > ageMax) errors.ageMax = 'End age must be the same as or after the start age.'
  const priority = String(body.priority || 'medium')
  if (!PRIORITIES.includes(priority)) errors.priority = 'Pick a priority.'
  const reason = String(body.reason || '').trim()
  if (!reason) errors.reason = 'Tell the Super Admin how this helps your patients.'
  else if (reason.length > 500) errors.reason = 'Keep this to 500 characters.'
  const referenceUrl = String(body.referenceUrl || '').trim()
  if (referenceUrl) {
    try {
      const u = new URL(referenceUrl)
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol')
    } catch {
      errors.referenceUrl = 'Enter a full link starting with https://'
    }
  }
  return {
    errors,
    value: { name, skill, age_min: ageMin, age_max: ageMax, priority, reason, reference_url: referenceUrl || null },
  }
}

export function serializeRequest(d, extra = {}) {
  return {
    id: String(d._id),
    name: d.name,
    skill: d.skill,
    skillLabel: SKILL_LABEL[d.skill] || d.skill,
    ageMin: d.age_min,
    ageMax: d.age_max,
    priority: d.priority,
    reason: d.reason,
    referenceUrl: d.reference_url || null,
    attachment: d.attachment ? { name: d.attachment.name, type: d.attachment.type, size: d.attachment.size } : null,
    status: d.status,
    submittedAt: d.created_at,
    approvedAt: d.approved_at || null,
    replies: (d.replies || []).map((r) => ({ from: r.from, name: r.name, message: r.message, at: r.at, status: r.status || null })),
    linkedGameId: d.linked_game_id ? String(d.linked_game_id) : null,
    resubmitOf: d.resubmit_of ? String(d.resubmit_of) : null,
    ...extra,
  }
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function appBase() {
  return (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || 'https://therapypro.app'
}

// In-app notification + email to the request's owner. Best-effort: a failed
// email never fails the status change that triggered it.
export async function notifyOwner(db, request, { title, body }) {
  const link = '/owner/gamified-activities/request'
  await db.collection('notifications').insertOne({
    recipient_email: request.owner_email, type: 'game_request', title, body, link,
    request_id: request._id, read: false, created_at: new Date(),
  })
  try {
    await sendEmail({
      to: request.owner_email,
      toName: request.owner_name,
      subject: title,
      html: `<div style="font-family:Arial,sans-serif;color:#2c4a3e;max-width:520px"><p>Hi ${esc(request.owner_name)},</p><p>${esc(body)}</p><p><a href="${appBase()}${link}" style="color:#234C40;font-weight:bold">View your requests</a></p><p style="color:#6b7c75;font-size:12px">Game: ${esc(request.name)}</p></div>`,
      plain: `Hi ${request.owner_name},\n\n${body}\n\nView your requests: ${appBase()}${link}\n\nGame: ${request.name}\n`,
    })
  } catch (err) {
    console.error('game request email failed:', err.message)
  }
}

const TRANSITIONS = {
  pending: ['approved', 'declined'],
  approved: ['dev', 'declined'],
  dev: ['live'],
  live: [],
  declined: [],
  withdrawn: [],
}

function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

// Applies a Super Admin action (a status change and/or a reply) to a request,
// records it, and notifies the owner. Used by the admin route and by the
// games routes (a linked game being created / published).
export async function applyRequestUpdate(db, requestId, { status, message, adminName = 'Super Admin' }) {
  const request = await db.collection('game_requests').findOne({ _id: requestId })
  if (!request) throw httpError(404, 'Request not found.')
  const text = String(message || '').trim().slice(0, 1000)
  const set = { updated_at: new Date() }
  const now = new Date()
  let changed = false
  if (status && status !== request.status) {
    if (!(TRANSITIONS[request.status] || []).includes(status)) {
      throw httpError(400, `This request is ${STATUS_LABEL[request.status].toLowerCase()} and cannot move to ${(STATUS_LABEL[status] || status).toLowerCase()}.`)
    }
    set.status = status
    if (status === 'approved') set.approved_at = now
    changed = true
  }
  if (!changed && !text) throw httpError(400, 'Nothing to update.')
  const push = text ? { replies: { from: 'Super Admin', name: adminName, message: text, at: now, status: set.status || null } } : null
  await db.collection('game_requests').updateOne({ _id: requestId }, { $set: set, ...(push ? { $push: push } : {}) })

  const label = STATUS_LABEL[set.status] || null
  const title = changed ? `Your game request is now: ${label}` : 'The Super Admin replied to your game request'
  const body = changed
    ? `"${request.name}" moved to ${label}.${text ? ` Super Admin: "${text}"` : ''}`
    : `Super Admin: "${text}"`
  await notifyOwner(db, request, { title, body })
  return db.collection('game_requests').findOne({ _id: requestId })
}
