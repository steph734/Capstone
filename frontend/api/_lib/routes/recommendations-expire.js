import { getMongo, getDb } from '../mongo.js'
import { expireStale } from '../sessionRecommendations.js'

// GET /api/recommendations/expire -> marks overdue 'Sent' recommendations as
// 'Expired' and notifies each therapist. Run on a schedule by Vercel Cron
// (see vercel.json), so it is locked behind CRON_SECRET like the attendance reminders.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('recommendations/expire: CRON_SECRET is not set — refusing to run.')
    return res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' })
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
  try {
    await getMongo()
    const expired = await expireStale(await getDb())
    return res.status(200).json({ ok: true, expired })
  } catch (err) {
    console.error('recommendations/expire error:', err)
    return res.status(500).json({ error: 'Could not expire recommendations.' })
  }
}
