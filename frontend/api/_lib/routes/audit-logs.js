import { getMongo } from '../mongo.js'
import { AuditLog } from '../models/auditLog.js'
import '../models/user.js' // registers the 'User' schema so populate() below works

// GET /api/audit-logs — most recent security/audit events, for the
// Super Admin audit log page.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const logs = await AuditLog.find({})
      .sort({ created_at: -1 })
      .limit(200)
      .populate('user_id', 'full_name email role')
      .lean()

    const data = logs.map((log) => ({
      id: log._id.toString(),
      created_at: log.created_at,
      action: log.action,
      description: log.description,
      ip_address: log.ip_address,
      role: log.user_id?.role || 'System',
      user: log.user_id?.full_name || 'Unknown',
      email: log.user_id?.email || '—',
    }))

    return res.status(200).json({ success: true, logs: data })
  } catch (err) {
    console.error('audit-logs error:', err)
    return res.status(500).json({ error: 'Could not load audit logs.' })
  }
}
