// GET /api/bookings/expire-holds: releases every unpaid slot hold whose time ran out (Vercel cron, see vercel.json).
// Holds are ALSO released lazily whenever someone starts a new booking, so this is only the safety net.
// Allowed for Vercel's cron runner, or with "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
import { getDb } from '../mongo.js'
import { expireStaleHolds } from '../bookingCore.js'
import { sendHoldReminders } from '../paymentNotifications.js'

export default async function handler(req, res) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  const fromVercelCron = /vercel-cron/i.test(String(req.headers['user-agent'] || ''))
  const bearerOk = secret && req.headers.authorization === `Bearer ${secret}`
  if (!fromVercelCron && !bearerOk) return res.status(401).json({ error: 'Not allowed.' })
  try {
    const db = await getDb()
    const released = await expireStaleHolds(db)
    const reminded = await sendHoldReminders(db).catch((e) => { console.error('hold reminders failed:', e.message); return 0 })
    return res.status(200).json({ released, reminded })
  } catch (err) {
    console.error('bookings/expire-holds error:', err)
    return res.status(500).json({ error: 'Could not release holds.' })
  }
}
