import { getDb } from '../mongo.js'

// Returns every day in the given month that already has a live appointment,
// keyed the same way the calendar keys its cells: "YYYY-M-D" (M is 0-based).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const year = Number(req.query.year)
  const month = Number(req.query.month) // 0-based, as the calendar keys it
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return res.status(400).json({ error: 'year and month query params are required.' })
  }

  try {
    const db = await getDb()
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 1))

    // session_date is stored as Date.UTC(year, month, day) by appointments/create,
    // so reading it back with the UTC getters keeps the same calendar day.
    const appointments = await db.collection('appointments')
      .find(
        {
          session_date: { $gte: start, $lt: end },
          status: { $ne: 'Cancelled' },
          is_archived: { $ne: true },
        },
        { projection: { session_date: 1 } }
      )
      .toArray()

    const booked = [...new Set(
      appointments.map(a => {
        const d = a.session_date
        return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
      })
    )]

    return res.status(200).json({ booked })
  } catch (err) {
    console.error('appointments/availability error:', err)
    return res.status(500).json({ error: err.message || 'Could not load availability.' })
  }
}
