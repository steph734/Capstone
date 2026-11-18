import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { ReportError, parseRange, resolveCompare, COMPARE_MODES } from '../reportsRange.js'
import { buildSummary, ensureReportIndexes } from '../ownerReports.js'
import { cacheGet, cacheSet } from '../reportsCache.js'

// A query value must be a single string (the central guard already strips operators/objects).
export const one = (v) => (typeof v === 'string' ? v : undefined)

export function sendReportError(res, err, label) {
  if (err instanceof ReportError) return res.status(err.status).json({ error: err.message, code: err.code })
  console.error(`${label}:`, err)
  return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load reports.' })
}

// GET /api/owner/reports/summary?from=&to=&compare=previous_period|previous_year|custom&compareFrom=&compareTo=
// Owner only. The owner comes from the session, never from the query string.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Owner'] })
    if (!ctx) return
    const q = req.query || {}
    const range = parseRange(one(q.from), one(q.to))
    const mode = one(q.compare) || 'previous_period'
    if (!COMPARE_MODES.includes(mode)) throw new ReportError('INVALID_DATE', 'Unknown comparison mode.')
    const compare = resolveCompare(range, mode, one(q.compareFrom), one(q.compareTo))

    const key = [ctx.user._id, range.from, range.to, compare.from, compare.to].join('|')
    let body = cacheGet(key)
    if (!body) {
      ensureReportIndexes(ctx.db)
      const data = await buildSummary(ctx.db, range, compare)
      body = { range: { from: range.from, to: range.to }, compareRange: compare, compare: mode, ...data }
      cacheSet(key, body)
    }
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ ...body, clamped: range.clamped, warnings: range.clamped ? ['RANGE_IN_FUTURE'] : [] })
  } catch (err) {
    return sendReportError(res, err, 'owner reports summary')
  }
}
