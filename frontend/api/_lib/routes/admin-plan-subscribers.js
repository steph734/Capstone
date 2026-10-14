import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { loadPlansAndFeatures, loadSubscriptions, loadAccounts, buildSubscriberList, csvCell } from '../plans.js'

// GET /api/admin/plans/subscribers?plan=<slug>&format=csv
// Subscribers of one plan (or all plans), as JSON or a CSV download. Super Admin only.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { plans } = await loadPlansAndFeatures(ctx.db)
    const [subs, accounts] = await Promise.all([loadSubscriptions(), loadAccounts(ctx.db)])
    const rows = buildSubscriberList(plans, subs, accounts, String(req.query.plan || ''))
    if (req.query.format === 'csv') {
      const head = ['Name', 'Email', 'Plan', 'Status', 'Subscribed since', 'Renews on', 'Monthly amount (PHP)']
      const lines = [head, ...rows.map((r) => [r.name, r.email, r.plan, r.status, r.since, r.renews, r.monthly])].map((l) => l.map(csvCell).join(','))
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="therapypro-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`)
      return res.send(`﻿${lines.join('\r\n')}\r\n`)
    }
    return res.json({ available: Boolean(subs), subscribers: rows })
  } catch (err) {
    console.error('admin plan subscribers error:', err)
    return res.status(err.status || 500).json({ error: 'Could not load subscribers.' })
  }
}
