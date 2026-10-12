// GET/PATCH/DELETE /api/emails/:id
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Email } from '../models/email.js'
import { EmailMailbox } from '../models/emailMailbox.js'
import { getSupabaseAdmin, ATTACHMENTS_BUCKET } from '../supabaseAdmin.js'
import { resolveCaller, patientNameById, userDisplayInfo } from '../emailAuth.js'

function oid(id) {
  if (!id) return null
  try {
    return new mongoose.Types.ObjectId(String(id))
  } catch {
    return null
  }
}

async function deleteAttachmentFiles(attachments) {
  if (!attachments?.length) return
  try {
    const supabase = getSupabaseAdmin()
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove(attachments.map((a) => a.file_path))
  } catch (err) {
    console.error('emails-item: could not delete attachment files:', err.message)
  }
}

async function handleGet(req, res, emailId) {
  const caller = await resolveCaller(req.query.email)
  if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

  const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId })
  if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." })

  const email = await Email.findById(emailId).lean()
  if (!email) return res.status(404).json({ error: 'Email not found.' })

  if (!mailboxRow.is_read) {
    mailboxRow.is_read = true
    mailboxRow.read_at = new Date()
    await mailboxRow.save()
  }

  const thread = await Email.find({ thread_id: email.thread_id }).sort({ email_created_at: 1 }).lean()
  const userIds = new Set()
  thread.forEach((e) => {
    userIds.add(String(e.sender_id))
    e.recipient_ids.forEach((id) => userIds.add(String(id)))
  })
  const displayInfo = await userDisplayInfo([...userIds])
  const patientName = await patientNameById(email.patient_id)

  const messages = thread.map((e) => ({
    id: String(e._id),
    sender: displayInfo.get(String(e.sender_id)) || { name: 'Unknown' },
    recipients: e.recipient_ids.map((id) => displayInfo.get(String(id)) || { name: 'Unknown' }),
    subject: e.subject,
    body: e.body,
    attachments: e.attachments.map((a, i) => ({ index: i, file_name: a.file_name, file_type: a.file_type, file_size: a.file_size })),
    email_status: e.email_status,
    email_sent_at: e.email_sent_at,
    email_created_at: e.email_created_at,
  }))

  return res.status(200).json({
    threadId: String(email.thread_id),
    patientName,
    isStarred: mailboxRow.is_starred,
    folder: mailboxRow.folder,
    messages,
  })
}

async function handlePatch(req, res, emailId) {
  const caller = await resolveCaller(req.body.email)
  if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

  const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId })
  if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." })

  if (typeof req.body.is_starred === 'boolean') {
    mailboxRow.is_starred = req.body.is_starred
  }
  if (req.body.folder === 'trash') {
    mailboxRow.previous_folder = mailboxRow.folder
    mailboxRow.folder = 'trash'
    mailboxRow.deleted_at = new Date()
  }
  if (req.body.restore) {
    mailboxRow.folder = mailboxRow.previous_folder || 'inbox'
    mailboxRow.previous_folder = null
    mailboxRow.deleted_at = null
  }
  await mailboxRow.save()

  return res.status(200).json({ mailboxRow })
}

async function handleDelete(req, res, emailId) {
  const caller = await resolveCaller(req.query.email)
  if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

  const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId })
  if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." })
  if (mailboxRow.folder !== 'trash') {
    return res.status(400).json({ error: 'Move the email to trash before deleting it permanently.' })
  }

  await EmailMailbox.deleteOne({ _id: mailboxRow._id })

  const remaining = await EmailMailbox.countDocuments({ email_id: emailId })
  if (remaining === 0) {
    const email = await Email.findById(emailId)
    if (email) {
      await deleteAttachmentFiles(email.attachments)
      await Email.deleteOne({ _id: emailId })
    }
  }

  return res.status(200).json({ success: true })
}

export default async function handler(req, res) {
  try {
    await getMongo()
    const emailId = oid(req.params?.id || req.query.id)
    if (!emailId) return res.status(400).json({ error: 'Invalid email id.' })

    if (req.method === 'GET') return await handleGet(req, res, emailId)
    if (req.method === 'PATCH') return await handlePatch(req, res, emailId)
    if (req.method === 'DELETE') return await handleDelete(req, res, emailId)
    res.setHeader('Allow', 'GET, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('/api/emails/:id error:', err)
    return res.status(500).json({ error: err.message || 'Could not process email request.' })
  }
}
