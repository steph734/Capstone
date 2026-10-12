// GET/POST /api/emails — list the caller's mailbox, or send/save a draft.
import mongoose from 'mongoose'
import multer from 'multer'
import { randomUUID } from 'crypto'
import { getMongo } from '../mongo.js'
import { Email } from '../models/email.js'
import { EmailMailbox } from '../models/emailMailbox.js'
import { getSupabaseAdmin, ATTACHMENTS_BUCKET } from '../supabaseAdmin.js'
import {
  resolveCaller,
  therapistOwnsPatient,
  guardianUserIdForPatient,
  patientNameById,
  userDisplayInfo,
} from '../emailAuth.js'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const uploadAttachmentsField = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
}).fields([{ name: 'attachments', maxCount: 5 }])

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadAttachmentsField(req, res, (err) => {
      if (!err) return resolve()
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'One of the attachments is too large (max 10MB each).'
        : 'One of the attachments has an unsupported file type.'
      reject(Object.assign(new Error(message), { status: 400 }))
    })
  })
}

function oid(id) {
  if (!id) return null
  try {
    return new mongoose.Types.ObjectId(String(id))
  } catch {
    return null
  }
}

async function uploadAttachments(emailId, files) {
  if (!files?.length) return []
  const supabase = getSupabaseAdmin()
  const out = []
  for (const file of files) {
    const path = `emails/${emailId}/${randomUUID()}-${file.originalname}`
    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false })
    if (error) throw new Error(`Could not upload attachment "${file.originalname}": ${error.message}`)
    out.push({ file_name: file.originalname, file_path: path, file_type: file.mimetype, file_size: file.size })
  }
  return out
}

async function handlePost(req, res) {
  const isMultipart = req.is('multipart/form-data')
  if (isMultipart) await runUpload(req, res)

  const payload = isMultipart ? JSON.parse(req.body.data || '{}') : req.body || {}
  const files = req.files?.attachments || []

  const callerEmail = String(payload.senderEmail || '').trim().toLowerCase()
  const caller = await resolveCaller(callerEmail)
  if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

  const subject = String(payload.subject || '').trim()
  const body = String(payload.body || '')
  const emailStatus = payload.email_status === 'draft' ? 'draft' : 'sent'
  const draftId = oid(payload.draft_id)
  const replyToId = oid(payload.reply_to_email_id)

  if (subject.length > 200) return res.status(400).json({ error: 'Subject is too long (max 200 characters).' })
  if (body.length > 20000) return res.status(400).json({ error: 'Message is too long (max 20,000 characters).' })
  if (emailStatus === 'sent' && !subject) return res.status(400).json({ error: 'Subject is required.' })
  if (emailStatus === 'sent' && !body) return res.status(400).json({ error: 'Message body is required.' })

  let draft = null
  if (draftId) {
    draft = await Email.findById(draftId)
    if (!draft || String(draft.sender_id) !== String(caller.user._id)) {
      return res.status(403).json({ error: 'That draft does not belong to you.' })
    }
  }

  let recipientIds = []
  let patientId = draft?.patient_id || null
  let threadId = draft?.thread_id || null

  if (replyToId) {
    const parentEmail = await Email.findById(replyToId)
    if (!parentEmail) return res.status(400).json({ error: 'The email you are replying to no longer exists.' })
    const hasAccess = await EmailMailbox.exists({ user_id: caller.user._id, email_id: parentEmail._id })
    if (!hasAccess) return res.status(403).json({ error: "You don't have access to that email." })

    const participants = [parentEmail.sender_id, ...parentEmail.recipient_ids].map(String)
    recipientIds = [...new Set(participants)].filter((id) => id !== String(caller.user._id)).map(oid)
    patientId = parentEmail.patient_id
    threadId = parentEmail.thread_id
  } else if (draft && draft.reply_to_email_id) {
    recipientIds = draft.recipient_ids
  } else {
    if (caller.role !== 'therapist') {
      return res.status(403).json({ error: 'Guardians can only reply to an email they received.' })
    }
    patientId = oid(payload.patient_id) || patientId
    if (!patientId) return res.status(400).json({ error: 'Missing patient_id.' })
    if (!caller.employee) return res.status(403).json({ error: "Your account isn't linked to a staff record yet." })
    const owns = await therapistOwnsPatient(caller.employee._id, patientId)
    if (!owns) return res.status(403).json({ error: "You don't have an appointment on record with this patient." })
    const guardianUserId = await guardianUserIdForPatient(patientId)
    if (!guardianUserId) return res.status(400).json({ error: "This patient's guardian doesn't have a TherapyPro account yet." })
    recipientIds = [guardianUserId]
  }

  if (!recipientIds.length) return res.status(400).json({ error: 'No recipient could be determined for this email.' })

  const now = new Date()
  const newId = draft ? draft._id : new mongoose.Types.ObjectId()
  if (!threadId) threadId = newId

  let attachments = draft?.attachments || []
  if (files.length) {
    attachments = await uploadAttachments(newId, files)
  }

  const docFields = {
    sender_id: caller.user._id,
    recipient_ids: recipientIds,
    patient_id: patientId,
    subject,
    body,
    email_status: emailStatus,
    thread_id: threadId,
    reply_to_email_id: replyToId || draft?.reply_to_email_id || null,
    attachments,
    email_sent_at: emailStatus === 'sent' ? now : null,
  }

  let email
  if (draft) {
    Object.assign(draft, docFields)
    email = await draft.save()
  } else {
    email = await Email.create({ _id: newId, ...docFields })
  }

  if (emailStatus === 'draft') {
    await EmailMailbox.findOneAndUpdate(
      { user_id: caller.user._id, email_id: email._id },
      { $set: { folder: 'drafts', is_read: true } },
      { upsert: true, setDefaultsOnInsert: true }
    )
  } else {
    await EmailMailbox.findOneAndUpdate(
      { user_id: caller.user._id, email_id: email._id },
      { $set: { folder: 'sent', is_read: true }, $unset: { deleted_at: '' } },
      { upsert: true, setDefaultsOnInsert: true }
    )
    await Promise.all(
      recipientIds.map((rid) =>
        EmailMailbox.findOneAndUpdate(
          { user_id: rid, email_id: email._id },
          { $set: { folder: 'inbox', is_read: false }, $unset: { deleted_at: '' } },
          { upsert: true, setDefaultsOnInsert: true }
        )
      )
    )
  }

  return res.status(200).json({ email })
}

async function handleGet(req, res) {
  const caller = await resolveCaller(req.query.email)
  if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

  const folder = String(req.query.folder || 'inbox')
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
  const search = String(req.query.search || '').trim()

  const match = { user_id: caller.user._id }
  if (folder === 'starred') {
    match.is_starred = true
    match.folder = { $ne: 'trash' }
  } else {
    match.folder = folder
  }

  let mailboxRows = await EmailMailbox.find(match).sort({ mailbox_created_at: -1 }).lean()
  let emails = await Email.find({ _id: { $in: mailboxRows.map((r) => r.email_id) } }).lean()
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    emails = emails.filter((e) => re.test(e.subject) || re.test(e.body))
  }
  const emailById = new Map(emails.map((e) => [String(e._id), e]))
  mailboxRows = mailboxRows.filter((r) => emailById.has(String(r.email_id)))

  const start = (page - 1) * limit
  const pageRows = mailboxRows.slice(start, start + limit)

  const allUserIds = new Set()
  for (const row of pageRows) {
    const e = emailById.get(String(row.email_id))
    allUserIds.add(String(e.sender_id))
    e.recipient_ids.forEach((id) => allUserIds.add(String(id)))
  }
  const displayInfo = await userDisplayInfo([...allUserIds])

  const items = await Promise.all(
    pageRows.map(async (row) => {
      const e = emailById.get(String(row.email_id))
      const patientName = await patientNameById(e.patient_id)
      return {
        id: String(e._id),
        sender: displayInfo.get(String(e.sender_id)) || { name: 'Unknown' },
        recipients: e.recipient_ids.map((id) => displayInfo.get(String(id)) || { name: 'Unknown' }),
        patientName,
        subject: e.subject,
        snippet: e.body.slice(0, 140),
        attachmentCount: e.attachments.length,
        email_status: e.email_status,
        email_sent_at: e.email_sent_at,
        email_created_at: e.email_created_at,
        is_read: row.is_read,
        is_starred: row.is_starred,
        folder: row.folder,
      }
    })
  )

  return res.status(200).json({ emails: items, page, total: mailboxRows.length })
}

export default async function handler(req, res) {
  try {
    await getMongo()
    if (req.method === 'POST') return await handlePost(req, res)
    if (req.method === 'GET') return await handleGet(req, res)
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('/api/emails error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not process email request.' })
  }
}
