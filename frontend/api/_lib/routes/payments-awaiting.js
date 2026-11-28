// GET /api/payments/awaiting-verification: kept so older open pages do not fail. Therapists no longer verify payments.
import { requireSession } from '../session.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
    if (!ctx) return
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ payments: [] }) // the Owner checks booking payments now (/api/booking-flow?action=ownerPaymentQueue)
  } catch (err) {
    console.error('payments/awaiting error:', err)
    return res.status(500).json({ error: 'Could not load payments.' })
  }
}
