// GET /api/server-time -> today's date in Philippine time, from the SERVER's clock.
// The session-note form shows this date (the browser clock is never used for a note's date).
import { manilaToday } from '../manilaDate.js'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ date: manilaToday(), now: new Date().toISOString(), timezone: 'Asia/Manila' })
}
