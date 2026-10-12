// GET /api/emails/:id/attachments/:index?email= — short-lived signed URL.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Email } from '../models/email.js'
import { EmailMailbox } from '../models/emailMailbox.js'
import { getSupabaseAdmin, ATTACHMENTS_BUCKET } from '../supabaseAdmin.js'
import { resolveCaller } from '../emailAuth.js'

function oid(id) {
  if (!id) return null
  try {
    return new mongoose.Types.ObjectId(String(id))
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const caller = await resolveCaller(req.query.email)
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

    const emailId = oid(req.params.id)
    const mailboxRow = await EmailMailbox.findOne({ user_id: caller.user._id, email_id: emailId })
    if (!mailboxRow) return res.status(403).json({ error: "You don't have access to that email." })

    const email = await Email.findById(emailId).lean()
    const attachment = email?.attachments?.[Number(req.params.index)]
    if (!attachment) return res.status(404).json({ error: 'Attachment not found.' })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.file_path, 60)
    if (error) throw new Error(error.message)

    return res.status(200).json({ url: data.signedUrl, file_name: attachment.file_name })
  } catch (err) {
    console.error('/api/emails/:id/attachments/:index error:', err)
    return res.status(500).json({ error: err.message || 'Could not get attachment.' })
  }
}
