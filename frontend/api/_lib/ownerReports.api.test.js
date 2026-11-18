// Handler-level tests for the Owner Reports endpoints (run with: npx vitest run api/_lib/ownerReports.api.test.js).
// The session and the data layer are mocked: this checks validation, error codes, owner-only access, range wiring,
// export file names and the audit trail, not MongoDB.
import { describe, expect, it, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ role: 'Owner', audit: vi.fn(async () => {}) }))

vi.mock('./mongo.js', () => ({ getMongo: async () => {}, getDb: async () => ({}) }))
vi.mock('./session.js', () => ({
  requireSession: async (req, res, { roles }) => {
    if (!roles.includes(mocks.role)) { res.status(403).json({ error: 'no', code: 'FORBIDDEN' }); return null }
    return { db: {}, user: { _id: 'owner1', role: mocks.role }, ip: '1.2.3.4' }
  },
}))
vi.mock('./noteAccess.js', () => ({ audit: mocks.audit }))
vi.mock('./ownerReports.js', () => ({
  MODULES: ['revenue', 'attendance', 'patient-growth', 'service-popularity', 'retention', 'staff-efficiency'],
  ensureReportIndexes: async () => {},
  // The value depends on the range: the regression test for "picking a range does nothing".
  buildSummary: async (_db, range) => ({
    kpis: [{ key: 'gross', value: Number(range.to.slice(8)) * 1000 + Number(range.from.slice(5, 7)), series: [1] }], modules: [], granularity: 'day', labels: [], empty: false,
  }),
  buildTables: async (_db, module, range) => [{
    title: 'Revenue report', cols: [{ key: 'm', label: 'Month', kind: 'text' }, { key: 'g', label: 'Gross', kind: 'money' }],
    rows: [{ m: '=evil()', g: 100 }], range,
  }],
}))

import summary from './routes/owner-reports-summary.js'
import exporter from './routes/owner-reports-export.js'
import { invalidateReportsCache } from './reportsCache.js'

function call(handler, { query = {}, params = {}, method = 'GET' } = {}) {
  return new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 200,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v },
      status(c) { this.statusCode = c; return this },
      json(b) { resolve({ status: this.statusCode, body: b, headers: this.headers }) },
      end(b) { resolve({ status: this.statusCode, body: b, headers: this.headers }) },
    }
    handler({ method, query, params, headers: {} }, res)
  })
}

const today = new Date().toISOString().slice(0, 10)
beforeEach(() => { mocks.role = 'Owner'; mocks.audit.mockClear(); invalidateReportsCache() })

describe('GET /api/owner/reports/summary', () => {
  it('returns different numbers for different ranges (regression: the filter used to do nothing)', async () => {
    const a = await call(summary, { query: { from: '2026-09-01', to: '2026-09-30' } })
    const b = await call(summary, { query: { from: '2026-10-01', to: '2026-10-31' } })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(a.body.kpis[0].value).not.toBe(b.body.kpis[0].value)
    expect(b.body.range).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(b.body.compareRange).toEqual({ from: '2026-08-31', to: '2026-09-30' })
  })
  it('maps bad input to the documented 422 codes', async () => {
    const cases = [
      [{ from: 'nope', to: '2026-10-31' }, 'INVALID_DATE'],
      [{ from: '2026-10-31', to: '2026-10-01' }, 'RANGE_REVERSED'],
      [{ from: '2999-01-01', to: '2999-01-31' }, 'RANGE_IN_FUTURE'],
      [{ from: '2020-01-01', to: '2023-01-01' }, 'RANGE_TOO_LARGE'],
      [{ from: '2026-10-01', to: '2026-10-31', compare: 'custom', compareFrom: '2026-10-10', compareTo: '2026-10-20' }, 'COMPARE_OVERLAPS'],
    ]
    for (const [query, code] of cases) {
      const r = await call(summary, { query })
      expect(r.status).toBe(422)
      expect(r.body.code).toBe(code)
    }
  })
  it('clamps an end date in the future and says so', async () => {
    const r = await call(summary, { query: { from: today.slice(0, 8) + '01', to: '2999-01-01' } })
    expect(r.status).toBe(200)
    expect(r.body.range.to).toBe(today)
    expect(r.body.clamped).toBe(true)
    expect(r.body.warnings).toContain('RANGE_IN_FUTURE')
  })
  it('rejects non-string query values and non-owners', async () => {
    expect((await call(summary, { query: { from: ['2026-10-01'], to: '2026-10-31' } })).body.code).toBe('INVALID_DATE')
    mocks.role = 'Therapist'
    const r = await call(summary, { query: { from: '2026-10-01', to: '2026-10-31' } })
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/owner/reports/:module/export', () => {
  it('streams a CSV named with the range, sanitised, and writes an audit entry without patient details', async () => {
    const r = await call(exporter, { params: { module: 'revenue' }, query: { format: 'csv', from: '2026-10-01', to: '2026-10-31' } })
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toMatch(/text\/csv/)
    expect(r.headers['content-disposition']).toContain('revenue-report_2026-10-01_to_2026-10-31.csv')
    expect(r.body.toString()).toContain("'=evil()")
    expect(mocks.audit).toHaveBeenCalledTimes(1)
    expect(mocks.audit.mock.calls[0][1].meta).toEqual({ module: 'revenue', format: 'csv', from: '2026-10-01', to: '2026-10-31', rows: 1 })
  })
  it('streams a PDF', async () => {
    const r = await call(exporter, { params: { module: 'all' }, query: { format: 'pdf', from: '2026-10-01', to: '2026-10-31' } })
    expect(r.headers['content-type']).toBe('application/pdf')
    expect(r.headers['content-disposition']).toContain('full-report_2026-10-01_to_2026-10-31.pdf')
    expect(Buffer.from(r.body).subarray(0, 4).toString()).toBe('%PDF')
  })
  it('custom report: only whitelisted modules, file named custom-report with the range', async () => {
    const ok = await call(exporter, { params: { module: 'custom' }, query: { format: 'csv', modules: 'revenue,attendance', from: '2026-10-01', to: '2026-10-31' } })
    expect(ok.headers['content-disposition']).toContain('custom-report_2026-10-01_to_2026-10-31.csv')
    const bad = await call(exporter, { params: { module: 'custom' }, query: { format: 'csv', modules: 'revenue,$where', from: '2026-10-01', to: '2026-10-31' } })
    expect(bad.status).toBe(400)
  })
  it('validates module, format and range; owner only', async () => {
    expect((await call(exporter, { params: { module: 'bogus' }, query: { from: '2026-10-01', to: '2026-10-31' } })).status).toBe(400)
    expect((await call(exporter, { params: { module: 'revenue' }, query: { format: 'xlsx', from: '2026-10-01', to: '2026-10-31' } })).status).toBe(400)
    expect((await call(exporter, { params: { module: 'revenue' }, query: { format: 'csv', from: '2026-10-31', to: '2026-10-01' } })).body.code).toBe('RANGE_REVERSED')
    mocks.role = 'Patient'
    expect((await call(exporter, { params: { module: 'revenue' }, query: { format: 'csv', from: '2026-10-01', to: '2026-10-31' } })).status).toBe(403)
    expect(mocks.audit).not.toHaveBeenCalled()
  })
})
