import { getMongo } from '../mongo.js'
import { getStreamServerClient, upsertStreamUser } from '../stream/serverClient.js'
import { resolveCallerIdentity } from '../stream/identity.js'

// POST /api/stream/token  { email }
// Mints a Stream user token (good for chat + video — one JWT covers both)
// for whichever TherapyPro identity that email belongs to, upserting the
// Stream user first so chat/calls can reference it immediately.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing email.' })

  try {
    await getMongo()
    const identity = await resolveCallerIdentity(email)
    if (!identity) {
      // 200 (not 404): a brand-new guardian has no patient record until their first booking,
      // which is expected, not a failed request. The client shows "messaging unavailable".
      return res.status(200).json({ unavailable: true, error: 'No TherapyPro account is linked to this email yet.' })
    }

    const client = getStreamServerClient()
    await upsertStreamUser(client, {
      id: identity.streamId,
      name: identity.name,
      image: identity.image,
      appRole: identity.kind,
      extra: identity.kind === 'patient'
        ? { patientName: [identity.patient?.first_name, identity.patient?.last_name].filter(Boolean).join(' ') }
        : { roleLabel: identity.employee?.position || identity.employee?.specialty || 'Therapist' },
    })

    const token = client.createToken(identity.streamId)

    return res.status(200).json({
      token,
      apiKey: process.env.STREAM_API_KEY,
      userId: identity.streamId,
      name: identity.name,
      image: identity.image || null,
      appRole: identity.kind,
    })
  } catch (err) {
    console.error('stream-token error:', err)
    return res.status(500).json({ error: err.message || 'Could not create a messaging session.' })
  }
}
