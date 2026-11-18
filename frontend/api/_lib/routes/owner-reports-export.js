import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { ReportError, parseRange } from '../reportsRange.js'
import { MODULES, buildTables } from '../ownerReports.js'
import { toCsv, toPdf, exportFileName, MAX_EXPORT_ROWS } from '../reportsExport.js'
import { one, sendReportError } from './owner-reports-summary.js'

const FORMATS = ['csv', 'pdf', 'json'] // json feeds the on-page "View report" table

// GET /api/owner/reports/:module/export?format=csv|pdf&from=&to=   (module: a report key, or `all`)
// Streams only data inside the range; the file name carries the range. Owner only, rate limited in guard.js.
// Each export is written to the audit trail (who, which module, which range, how many rows; no patient details).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Owner'] })
    if (!ctx) return
    const module = one(req.params?.module)
    if (module !== 'all' && module !== 'custom' && !MODULES.includes(module)) throw new ReportError('INVALID_MODULE', 'Unknown report module.', 400)
    // Custom report builder: ?modules=revenue,attendance (each one validated against the allow-list).
    let chosen
    if (module === 'custom') {
      chosen = [...new Set(String(one(req.query?.modules) || '').split(',').filter(Boolean))]
      if (!chosen.length || chosen.some((m) => !MODULES.includes(m))) throw new ReportError('INVALID_MODULE', 'Pick at least one valid report module.', 400)
    }
    const format = one(req.query?.format) || 'csv'
    if (!FORMATS.includes(format)) throw new ReportError('INVALID_FORMAT', 'Format must be csv or pdf.', 400)
    const range = parseRange(one(req.query?.from), one(req.query?.to))

    const tables = await buildTables(ctx.db, module, range, chosen)
    const rows = tables.reduce((n, t) => n + Math.min(t.rows.length, MAX_EXPORT_ROWS), 0)

    if (format === 'json') {
      res.setHeader('Cache-Control', 'private, no-store')
      return res.json({ range: { from: range.from, to: range.to }, clamped: range.clamped, tables })
    }

    await audit(ctx.db, { user: ctx.user, action: 'report_export', ip: ctx.ip, meta: { module, format, from: range.from, to: range.to, rows, ...(chosen ? { modules: chosen } : {}) } })

    const body = format === 'pdf' ? toPdf(tables, range) : toCsv(tables, range)
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(module, range, format)}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Report-Rows', String(rows))
    return res.status(200).end(body)
  } catch (err) {
    return sendReportError(res, err, 'owner reports export')
  }
}
