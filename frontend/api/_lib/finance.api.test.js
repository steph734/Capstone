// Handler-level tests: roles, sessions, error format and wiring (session + data layer mocked).
// Run: npx vitest run api/_lib/finance.api.test.js
import { describe, expect, it, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'Owner', session: true, listArgs: null }))

vi.mock('./mongo.js', () => ({ getMongo: async () => {}, getDb: async () => ({}) }))
vi.mock('./session.js', () => ({
  requireSession: async (req, res, { roles }) => {
    if (!state.session) { res.status(401).json({ error: 'Please sign in again.', code: 'NO_SESSION' }); return null }
    if (!roles.includes(state.role)) { res.status(403).json({ error: 'You do not have access to this.', code: 'FORBIDDEN' }); return null }
    return { db: {}, user: { _id: 'u1', role: state.role }, ip: '1.1.1.1' }
  },
}))
vi.mock('./expensesCore.js', async (orig) => ({
  ...(await orig()),
  listExpenses: async (_db, q) => { state.listArgs = q; return { items: [], page: 1, limit: 20, total: 0, pages: 1 } },
  expenseSummary: async () => ({ total: { amount: 0, count: 0 } }),
  getExpense: async (_db, id) => { const { FinanceError, toOid } = await import('./finance.js'); toOid(id); throw new FinanceError('NOT_FOUND', 'Expense not found.', 404) },
}))
vi.mock('./invoicesCore.js', async (orig) => ({ ...(await orig()), listInvoices: async () => ({ items: [], page: 1, limit: 20, total: 0, pages: 1 }), invoiceSummary: async () => ({}) }))

import { expensesCollection, expensesSummary, expenseItem, expenseMarkPaid, expenseVoid, expenseAttachments, vendorsRoute } from './routes/owner-expenses.js'
import { invoicesCollection, invoicesSummary, invoiceItem, invoiceMarkPaid, invoiceVoid, invoicePdf, invoiceSend, patientBillableSessions, clinicRoute } from './routes/owner-invoices.js'

function call(handler, { method = 'GET', query = {}, params = {}, body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 200, headersSent: false,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v }, set(k, v) { this.setHeader(k, v) },
      status(c) { this.statusCode = c; return this },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b, headers: this.headers }) },
      end(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b, headers: this.headers }) },
    }
    handler({ method, query, params, body, headers }, res)
  })
}
const ID = 'a'.repeat(24)
const ROUTES = [
  ['GET expenses', expensesCollection, {}], ['GET expenses/summary', expensesSummary, {}], ['GET expense', expenseItem, { params: { id: ID } }],
  ['POST expense mark-paid', expenseMarkPaid, { method: 'POST', params: { id: ID }, body: {} }], ['POST expense void', expenseVoid, { method: 'POST', params: { id: ID }, body: {} }],
  ['POST expense attachments', expenseAttachments, { method: 'POST', params: { id: ID } }], ['GET vendors', vendorsRoute, {}],
  ['GET invoices', invoicesCollection, {}], ['GET invoices/summary', invoicesSummary, {}], ['GET invoice', invoiceItem, { params: { id: ID } }],
  ['POST invoice send', invoiceSend, { method: 'POST', params: { id: ID } }], ['POST invoice mark-paid', invoiceMarkPaid, { method: 'POST', params: { id: ID }, body: {} }],
  ['POST invoice void', invoiceVoid, { method: 'POST', params: { id: ID }, body: {} }], ['GET invoice pdf', invoicePdf, { params: { id: ID } }],
  ['GET billable sessions', patientBillableSessions, { params: { id: ID } }], ['GET clinic', clinicRoute, {}],
]

beforeEach(() => { state.role = 'Owner'; state.session = true; state.listArgs = null })

describe('who may call the finance API', () => {
  it('Therapists and Patients get 403 FORBIDDEN on every route', async () => {
    for (const role of ['Therapist', 'Patient']) {
      state.role = role
      for (const [name, h, opts] of ROUTES) {
        const r = await call(h, opts)
        expect(r.status, `${role} ${name}`).toBe(403)
        expect(r.body.code).toBe('FORBIDDEN')
      }
    }
  })
  it('no session is a 401 on every route', async () => {
    state.session = false
    for (const [name, h, opts] of ROUTES) expect((await call(h, opts)).status, name).toBe(401)
  })
  it('Owner and Super Admin get through', async () => {
    for (const role of ['Owner', 'Super Admin']) {
      state.role = role
      expect((await call(expensesCollection)).status).toBe(200)
      expect((await call(invoicesCollection)).status).toBe(200)
    }
  })
  it('unsupported methods return 405 with an Allow header', async () => {
    const r = await call(expensesSummary, { method: 'DELETE' })
    expect(r.status).toBe(405)
    expect(r.headers.allow).toBe('GET')
  })
})

describe('request handling', () => {
  it('passes the branch filter and other query params to the data layer (branch scoping)', async () => {
    await call(expensesCollection, { query: { branch_id: ID, expense_type: 'Utility', q: 'light' } })
    expect(state.listArgs).toMatchObject({ branch_id: ID, expense_type: 'Utility', q: 'light' })
  })
  it('a malformed id is a 422 VALIDATION_ERROR and a missing record is a 404 NOT_FOUND, in the shared error format', async () => {
    const bad = await call(expenseItem, { params: { id: 'nope' } })
    expect(bad.status).toBe(422); expect(bad.body.code).toBe('VALIDATION_ERROR'); expect(bad.body.fields.id).toBeTruthy()
    const gone = await call(expenseItem, { params: { id: ID } })
    expect(gone.status).toBe(404); expect(gone.body).toMatchObject({ code: 'NOT_FOUND', error: 'Expense not found.' })
  })
  it('an invalid Idempotency-Key is rejected before anything is created', async () => {
    const r = await call(invoicesCollection, { method: 'POST', body: {}, headers: { 'idempotency-key': 'x' } })
    expect(r.status).toBe(422)
    expect(r.body.fields['Idempotency-Key']).toBeTruthy()
  })
  it('responses are never cached', async () => {
    expect((await call(expensesCollection)).headers['cache-control']).toBe('private, no-store')
  })
})
