// GET /api/emails/unread-count?email=
import { getMongo } from '../mongo.js'
import { EmailMailbox } from '../models/emailMailbox.js'
import { resolveCaller } from '../emailAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const caller = await resolveCaller(req.query.email)
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })
    const count = await EmailMailbox.countDocuments({ user_id: caller.user._id, folder: 'inbox', is_read: false })
    return res.status(200).json({ count })
  } catch (err) {
    console.error('/api/emails/unread-count error:', err)
    return res.status(500).json({ error: err.message || 'Could not load unread count.' })
  }
}
