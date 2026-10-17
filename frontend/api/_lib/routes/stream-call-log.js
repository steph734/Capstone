import { getMongo, getDb } from '../mongo.js'
import { resolveCallerIdentity } from '../stream/identity.js'

// POST /api/stream/call-log  { action: 'create'|'ongoing'|'end', streamCallId, ... }
// Best-effort mirror of a call's lifecycle into `call_logs`, driven by the
// client (CallManager.jsx) at the moments it already knows about: creation
// (ringing), the local participant joining (ongoing), and every way a call
// ends (completed / declined / cancelled). Never blocks the actual call.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, streamCallId } = req.body || {}
  if (!action || !streamCallId) {
    return res.status(400).json({ error: 'Missing action or streamCallId.' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const now = new Date()

    if (action === 'create') {
      const { channelId, callType, email } = req.body || {}
      if (!channelId || !callType || !email) {
        return res.status(400).json({ error: 'Missing channelId, callType or email.' })
      }
      const caller = await resolveCallerIdentity(email)
      const conversation = await db.collection('conversations').findOne({ stream_channel_id: channelId })
      if (!caller?.userId || !conversation) {
        // No FK to hang the log on (e.g. conversation mirror wasn't written) —
        // skip quietly rather than breaking the call itself.
        return res.status(200).json({ ok: false })
      }
      const receiverId = String(conversation.therapist_id) === String(caller.userId)
        ? conversation.guardian_id
        : conversation.therapist_id

      await db.collection('call_logs').updateOne(
        { stream_call_id: streamCallId },
        {
          $setOnInsert: {
            stream_call_id: streamCallId,
            conversation_id: conversation._id,
            patient_id: conversation.patient_id || null,
            call_type: callType,
            caller_id: caller.userId,
            receiver_id: receiverId,
            call_status: 'ringing',
            call_created_at: now,
          },
        },
        { upsert: true }
      )
      return res.status(200).json({ ok: true })
    }

    if (action === 'ongoing') {
      await db.collection('call_logs').updateOne(
        { stream_call_id: streamCallId },
        { $set: { call_status: 'ongoing', call_started_at: now } }
      )
      return res.status(200).json({ ok: true })
    }

    if (action === 'end') {
      const { status } = req.body || {}
      const doc = await db.collection('call_logs').findOne({ stream_call_id: streamCallId })
      const durationSeconds = doc?.call_started_at
        ? Math.max(0, Math.round((now - new Date(doc.call_started_at)) / 1000))
        : 0
      // Idempotent: the first 'end' wins, later duplicates for the same call are ignored.
      if (doc?.call_ended_at) return res.status(200).json({ ok: true, duplicate: true })
      await db.collection('call_logs').updateOne(
        { stream_call_id: streamCallId },
        { $set: { call_status: status || 'completed', call_ended_at: now, call_duration_seconds: durationSeconds } }
      )
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action.' })
  } catch (err) {
    console.error('stream-call-log error:', err)
    return res.status(500).json({ error: err.message || 'Could not log call.' })
  }
}
