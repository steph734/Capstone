import { getMongo, getDb } from '../mongo.js'
import { userIdForStreamId } from '../stream/identity.js'

// POST /api/stream/message-log  { channelId, text, senderStreamId }
// Best-effort mirror of the latest message into `conversations` (preview +
// last-message fields) — fired client-side on every message.new event. Never
// the source of truth (Stream is), so a failure here never surfaces to chat.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const channelId = String(req.body?.channelId || '').trim()
  const senderStreamId = String(req.body?.senderStreamId || '').trim()
  const text = req.body?.text != null ? String(req.body.text) : null
  if (!channelId || !senderStreamId) {
    return res.status(400).json({ error: 'Missing channelId or senderStreamId.' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const senderUserId = await userIdForStreamId(senderStreamId)
    const now = new Date()

    const update = { last_message_at: now, conversation_updated_at: now }
    if (text != null) update.last_message_preview = text.slice(0, 200)
    if (senderUserId) update.last_message_by = senderUserId

    await db.collection('conversations').updateOne({ stream_channel_id: channelId }, { $set: update })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('stream-message-log error:', err)
    return res.status(500).json({ error: err.message || 'Could not log message.' })
  }
}
