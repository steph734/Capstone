// Integration tests for per-branch TIN / invoice details, running the REAL admin + owner handlers against a REAL MongoDB.
// Opt-in:   FINANCE_INTEGRATION=1 npx vitest run api/_lib/branchBilling.integration.test.js
// It creates a throwaway database (therapypro_test_branch_<timestamp>) on the cluster in MONGO_URI, copies the LIVE `branchs`
// validator into it (with Draft + Declined added to the status enum, as the migration does), and DROPS it at the end.
// The real `therapypro` database is only read (to copy the validator).
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { MongoClient, ObjectId } from 'mongodb'
import mongoose from 'mongoose'

const state = vi.hoisted(() => ({ user: null }))
vi.mock('./session.js', async () => {
  const { default: mg } = await import('mongoose')
  return {
    requireSession: async (req, res, { roles }) => {
      if (!state.user) { res.status(401).json({ error: 'Please sign in again.', code: 'NO_SESSION' }); return null }
      if (!roles.includes(state.user.role)) { res.status(403).json({ error: 'You do not have access to this.', code: 'FORBIDDEN' }); return null }
      return { db: mg.connection.db, user: state.user, ip: '1.1.1.1' }
    },
  }
})

import adminBranches from './routes/admin-branches.js'
import adminBranchItem from './routes/admin-branch-item.js'
import ownerBilling from './routes/owner-billing-branches.js'
import { createInvoice, invoiceClinic } from './invoicesCore.js'

const RUN = process.env.FINANCE_INTEGRATION === '1'
const d = RUN ? describe : describe.skip

const TIN_A = '456-657-670-00001'
const TIN_B = '123-456-789-123'
const hours = { mon: { open: true, from: '08:00', to: '17:00' }, tue: { open: false, from: '08:00', to: '17:00' } }

function call(handler, { method = 'GET', params = {}, body, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 200, headersSent: false,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v }, set(k, v) { this.setHeader(k, v) },
      status(c) { this.statusCode = c; return this },
      json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }) },
    }
    handler({ method, params, body, query, headers: {} }, res)
  })
}

d('branch TIN and invoice details on the real handlers', () => {
  let client; let testDb; let dbName
  const ids = {}
  const sa = () => { state.user = { _id: ids.sa, role: 'Super Admin' } }
  const ownerA = () => { state.user = { _id: ids.ownerA, role: 'Owner' } }
  const raw = (id) => testDb.collection('branchs').findOne({ _id: new ObjectId(id) })
  const create = (over = {}) => call(adminBranches, { method: 'POST', body: { name: `Branch ${Math.random().toString(36).slice(2, 8)}`, city: 'Iloilo City', province: 'Iloilo', street: '2F Atrium', phone: '(033) 000 0000', capacity: 10, services: ['Speech'], hours, status: 'Under review', ...over } })

  beforeAll(async () => {
    try { process.loadEnvFile?.('.env') } catch { /* shell env */ }
    const live = process.env.MONGO_URI
    dbName = `therapypro_test_branch_${Date.now()}`
    process.env.MONGO_URI = live.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]*/, `$1/${dbName}`) // the handlers connect to the throwaway DB
    client = new MongoClient(live, { serverSelectionTimeoutMS: 20000 })
    await client.connect()
    testDb = client.db(dbName)
    const info = (await client.db().listCollections({ name: 'branchs' }).toArray())[0] // the real DB: read-only
    const validator = JSON.parse(JSON.stringify(info.options.validator))
    for (const s of ['Draft', 'Declined']) if (!validator.$jsonSchema.properties.status.enum.includes(s)) validator.$jsonSchema.properties.status.enum.push(s)
    await testDb.createCollection('branchs', { validator, validationLevel: 'strict', validationAction: 'error' })
    await testDb.collection('branchs').createIndex({ tin: 1 }, { unique: true, name: 'uniq_branch_tin', partialFilterExpression: { tin: { $exists: true } } })
    ids.sa = (await testDb.collection('users').insertOne({ role: 'Super Admin', email: 'sa@example.com', full_name: 'SA' })).insertedId
    ids.ownerA = (await testDb.collection('users').insertOne({ role: 'Owner', email: 'a@example.com', full_name: 'Owner A' })).insertedId
    ids.ownerB = (await testDb.collection('users').insertOne({ role: 'Owner', email: 'b@example.com', full_name: 'Owner B' })).insertedId
    await testDb.collection('clinic_settings').insertOne({ _id: 'clinic', clinic_name: 'TherapyPro' })
  }, 60000)

  afterAll(async () => {
    await mongoose.disconnect().catch(() => {})
    if (testDb) await testDb.dropDatabase()
    await client?.close()
  }, 60000)

  describe('Super Admin: create and edit a branch', () => {
    it('creates a branch with all five fields, stored under the right names, with an audit entry per field', async () => {
      sa()
      const r = await create({ owner: { id: String(ids.ownerA) }, email: 'iloilo@therapypro.ph', tin: TIN_A, billingEmail: 'Billing.Iloilo@TherapyPro.ph', website: 'www.therapypro.ph', paymentInstructions: 'Pay by GCash or card, or at the front desk.', defaultInvoiceTerms: 'Payment is due on the due date shown.' })
      expect(r.status).toBe(201)
      expect(r.body.branch).toMatchObject({ tin: TIN_A, billingEmail: 'billing.iloilo@therapypro.ph', website: 'www.therapypro.ph' })
      const doc = await raw(r.body.branch.id)
      expect(doc).toMatchObject({ tin: TIN_A, billing_email: 'billing.iloilo@therapypro.ph', website: 'www.therapypro.ph', payment_instructions: 'Pay by GCash or card, or at the front desk.', default_invoice_terms: 'Payment is due on the due date shown.' })
      expect(doc.address).toBe('2F Atrium, Iloilo City, Iloilo') // required by the live validator
      expect(doc.email).toBe('iloilo@therapypro.ph') // the branch email keeps its own field, separate from billing_email
      ids.iloilo = r.body.branch.id
      const logs = await testDb.collection('audit_logs').find({ action: 'branch_billing_changed', 'meta.branch_id': ids.iloilo }).toArray()
      expect(logs.map((l) => l.meta.field).sort()).toEqual(['billing_email', 'default_invoice_terms', 'payment_instructions', 'tin', 'website'])
      expect(logs[0].user_id).toBeTruthy(); expect(logs[0].created_at).toBeTruthy()
    })
    it('Under review without a TIN is fine, and blank optional fields are OMITTED, never saved as ""', async () => {
      sa()
      const r = await create({ tin: '', billingEmail: '', website: '', paymentInstructions: '', defaultInvoiceTerms: '' })
      expect(r.status).toBe(201)
      const doc = await raw(r.body.branch.id)
      for (const k of ['tin', 'billing_email', 'website', 'payment_instructions', 'default_invoice_terms']) expect(Object.keys(doc)).not.toContain(k)
      const draft = await call(adminBranches, { method: 'POST', body: { name: 'Draft branch', draft: true } })
      expect(draft.status).toBe(201); expect(draft.body.branch.status).toBe('Draft') // Draft is accepted once the enum has it
    })
    it('Active without a TIN is refused: 422 TIN_REQUIRED_FOR_ACTIVE', async () => {
      sa()
      const r = await create({ status: 'Active', owner: { id: String(ids.ownerA) } })
      expect(r.status).toBe(422); expect(r.body.code).toBe('TIN_REQUIRED_FOR_ACTIVE')
      expect(r.body.fields.tin).toBe('Add a TIN before setting this branch to Active. Active branches can send invoices.')
      const ok = await create({ status: 'Active', owner: { id: String(ids.ownerA) }, tin: TIN_B })
      expect(ok.status).toBe(201); expect(ok.body.branch.status).toBe('Active')
      ids.active = ok.body.branch.id
    })
    it('invalid TIN formats are 422 VALIDATION_ERROR', async () => {
      sa()
      for (const tin of ['456657670', '45665767', 'abc-def-ghi-jkl', '456-657-670', '456-657-670-123456']) {
        const r = await create({ tin })
        expect(r.status, tin).toBe(422); expect(r.body.code).toBe('VALIDATION_ERROR'); expect(r.body.fields.tin).toMatch(/000-000-000-00000/)
      }
      const bad = await create({ billingEmail: 'not-an-email', website: 'w'.repeat(201) })
      expect(Object.keys(bad.body.fields)).toEqual(expect.arrayContaining(['billingEmail', 'website']))
    })
    it('a duplicate TIN is 409 DUPLICATE_TIN and names the branch that uses it; the unique index backs it up', async () => {
      sa()
      const r = await create({ tin: TIN_A })
      expect(r.status).toBe(409); expect(r.body.code).toBe('DUPLICATE_TIN')
      expect(r.body.error).toContain((await raw(ids.iloilo)).branch_name)
      await expect(testDb.collection('branchs').insertOne({ branch_name: 'X', address: 'x', contact_number: '1', status: 'Active', tin: TIN_A })).rejects.toThrow(/duplicate key/i)
    })
    it('editing: blank unsets a field; the TIN can change; every change is audited with old and new', async () => {
      sa()
      const r = await call(adminBranchItem, { method: 'PATCH', params: { id: ids.iloilo }, body: { name: 'Iloilo Branch', city: 'Iloilo City', province: 'Iloilo', street: '2F Atrium', phone: '(033) 000 0000', capacity: 10, services: ['Speech'], hours, website: '', tin: '987-654-321-00002' } })
      expect(r.status).toBe(200)
      const doc = await raw(ids.iloilo)
      expect(Object.keys(doc)).not.toContain('website'); expect(doc.tin).toBe('987-654-321-00002'); expect(doc.billing_email).toBe('billing.iloilo@therapypro.ph')
      const tinLog = await testDb.collection('audit_logs').findOne({ action: 'branch_billing_changed', 'meta.branch_id': ids.iloilo, 'meta.field': 'tin', 'meta.new': '987-654-321-00002' })
      expect(tinLog.meta.old).toBe(TIN_A)
      expect(await testDb.collection('audit_logs').findOne({ action: 'branch_billing_changed', 'meta.field': 'website', 'meta.new': null })).toBeTruthy()
    })
    it('an Active branch that has a TIN cannot lose it; older Active branches without one stay editable; approve needs a TIN', async () => {
      sa()
      const body = { name: 'Active renamed', city: 'Iloilo City', province: 'Iloilo', street: '2F Atrium', phone: '(033) 000 0000', capacity: 10, services: ['Speech'], hours }
      const lose = await call(adminBranchItem, { method: 'PATCH', params: { id: ids.active }, body: { ...body, tin: '' } })
      expect(lose.status).toBe(422); expect(lose.body.code).toBe('TIN_REQUIRED_FOR_ACTIVE')
      const legacy = (await testDb.collection('branchs').insertOne({ branch_name: 'Legacy', address: 'Old St', contact_number: '0917 123 4567', status: 'Active', owner_id: ids.ownerB })).insertedId
      const rename = await call(adminBranchItem, { method: 'PATCH', params: { id: String(legacy) }, body: { ...body, name: 'Legacy renamed', phone: '0917 123 4567' } })
      expect(rename.status).toBe(200); expect(rename.body.branch.tin).toBe('')
      const review = (await create({ owner: { id: String(ids.ownerA) } })).body.branch.id
      const approve = await call(adminBranchItem, { method: 'PATCH', params: { id: review }, body: { action: 'approve' } })
      expect(approve.status).toBe(422); expect(approve.body.code).toBe('TIN_REQUIRED_FOR_ACTIVE')
      ids.legacy = String(legacy)
    })
    it('GET /api/admin/branches/:id returns the billing fields; an unknown id is 404', async () => {
      sa()
      const g = await call(adminBranchItem, { method: 'GET', params: { id: ids.iloilo } })
      expect(g.status).toBe(200); expect(g.body.branch).toMatchObject({ tin: '987-654-321-00002', billingEmail: 'billing.iloilo@therapypro.ph' })
      expect((await call(adminBranchItem, { method: 'GET', params: { id: String(new ObjectId()) } })).status).toBe(404)
    })
    it('a MongoDB document-validation error (121) is a 422 VALIDATION_ERROR, not a 500', async () => {
      sa()
      const info = (await testDb.listCollections({ name: 'branchs' }).toArray())[0]
      const strict = JSON.parse(JSON.stringify(info.options.validator))
      strict.$jsonSchema.properties.website.maxLength = 5 // stricter than our own 200 limit: only MongoDB can catch this
      await testDb.command({ collMod: 'branchs', validator: strict })
      try {
        const r = await create({ website: 'www.example.com' })
        expect(r.status).toBe(422); expect(r.body.code).toBe('VALIDATION_ERROR'); expect(r.body.error).toMatch(/website/)
      } finally { await testDb.command({ collMod: 'branchs', validator: info.options.validator }) }
    })
    it('only the Super Admin can create or edit a branch: an Owner gets 403', async () => {
      ownerA()
      expect((await create({ tin: '111-111-111-111' })).status).toBe(403)
      expect((await call(adminBranchItem, { method: 'PATCH', params: { id: ids.iloilo }, body: { tin: '111-111-111-111' } })).status).toBe(403)
      state.user = null
      expect((await create()).status).toBe(401)
    })
  })

  describe('Owner: clinic details on invoices (read only)', () => {
    it('GET returns only the branches they own, with every detail field', async () => {
      ownerA()
      const r = await call(ownerBilling)
      expect(r.status).toBe(200)
      const ids2 = r.body.branches.map((b) => b.id)
      expect(ids2).toContain(ids.iloilo); expect(ids2).not.toContain(ids.legacy) // Legacy belongs to Owner B
      expect(r.body.clinicName).toBe('TherapyPro')
      const row = r.body.branches.find((x) => x.id === ids.iloilo)
      expect(Object.keys(row)).toEqual(expect.arrayContaining(['id', 'name', 'status', 'address', 'phone', 'tin', 'billingEmail', 'website', 'paymentInstructions', 'defaultInvoiceTerms']))
      expect(row.tin).toBe('987-654-321-00002')
    })
    it('GET one branch works for their own and is 404 for anyone else\'s or an unknown id', async () => {
      ownerA()
      expect((await call(ownerBilling, { params: { id: ids.iloilo } })).status).toBe(200)
      expect((await call(ownerBilling, { params: { id: ids.legacy } })).status).toBe(404)
      expect((await call(ownerBilling, { params: { id: String(new ObjectId()) } })).status).toBe(404)
      expect((await call(ownerBilling, { params: { id: 'nope' } })).status).toBe(404)
    })
    it('EVERY write is refused with 403 FORBIDDEN on the server, whatever the body, and nothing changes', async () => {
      ownerA()
      const before = await raw(ids.iloilo)
      const bodies = [{ tin: '111-111-111-111' }, { billingEmail: 'hacked@x.ph' }, { website: 'hacked.ph' }, { paymentInstructions: 'send money here' }, { defaultInvoiceTerms: 'x' }, { branch_name: 'Owned' }]
      for (const method of ['PATCH', 'PUT', 'POST', 'DELETE']) {
        for (const body of bodies) {
          const r = await call(ownerBilling, { method, params: { id: ids.iloilo }, body })
          expect(r.status, method + JSON.stringify(body)).toBe(403); expect(r.body.code).toBe('FORBIDDEN')
        }
      }
      const r2 = await call(ownerBilling, { method: 'PATCH', params: { id: ids.legacy }, body: { website: 'x.ph' } }) // someone else's branch: still a refusal
      expect(r2.status).toBe(403)
      const after = await raw(ids.iloilo)
      expect(after).toEqual(before)
      expect((await raw(ids.legacy)).website).toBeUndefined()
    })
    it('the old clinic-wide PUT /api/owner/clinic is a 403 too', async () => {
      ownerA()
      const { clinicRoute } = await import('./routes/owner-invoices.js')
      const r = await call(clinicRoute, { method: 'PUT', body: { clinic_name: 'Hacked', business_tin: '45665767' } })
      expect(r.status).toBe(403); expect(r.body.code).toBe('FORBIDDEN')
      expect((await testDb.collection('clinic_settings').findOne({ _id: 'clinic' })).clinic_name).toBe('TherapyPro')
    })
    it('Therapists and Patients get 403; the Super Admin sees every branch and can edit them on the admin route', async () => {
      for (const role of ['Therapist', 'Patient']) { state.user = { _id: new ObjectId(), role }; expect((await call(ownerBilling)).status).toBe(403) }
      sa()
      expect((await call(ownerBilling)).body.branches.length).toBeGreaterThan(2)
      const edit = await call(adminBranchItem, { method: 'PATCH', params: { id: ids.iloilo }, body: { name: 'Iloilo Branch', city: 'Iloilo City', province: 'Iloilo', street: '2F Atrium', phone: '(033) 000 0000', capacity: 10, services: ['Speech'], hours, website: 'sa-edit.ph' } })
      expect(edit.status).toBe(200)
      expect((await raw(ids.iloilo)).website).toBe('sa-edit.ph')
      ownerA()
      expect((await call(ownerBilling, { params: { id: ids.iloilo } })).body.branch.website).toBe('sa-edit.ph') // the Owner sees the change automatically
    })
  })

  describe('invoices read the branch and keep a snapshot', () => {
    let patientId; let ctx
    beforeAll(async () => {
      ctx = { db: testDb, user: { _id: ids.sa, role: 'Owner' }, ip: 't' }
      patientId = (await testDb.collection('patients').insertOne({ first_name: 'Miguel', last_name: 'Tayao', PatientID: 'PT-0187' })).insertedId
    })
    const body = (branchId) => ({ branch_id: String(branchId), patient_id: String(patientId), invoice_type: 'Custom', billing_contact: { name: 'Guardian', email: 'g@example.com' }, issue_date: '2026-11-18', payment_terms: 'Net 7', line_items: [{ description: 'Package', quantity: 1, unit_price: 450000 }] })

    it('copies the branch details onto the invoice, and editing the branch later never changes it', async () => {
      const { invoice } = await createInvoice(testDb, ctx, body(ids.iloilo))
      expect(invoice.clinic_snapshot).toMatchObject({ tin: '987-654-321-00002', billing_email: 'billing.iloilo@therapypro.ph', website: 'sa-edit.ph', branch_name: 'Iloilo Branch' })
      expect(invoice.terms).toBe('Payment is due on the due date shown.') // pre-filled from the branch's default terms
      sa()
      expect((await call(adminBranchItem, { method: 'PATCH', params: { id: ids.iloilo }, body: { name: 'Iloilo Branch', city: 'Iloilo City', province: 'Iloilo', street: '2F Atrium', phone: '(033) 000 0000', capacity: 10, services: ['Speech'], hours, tin: '555-555-555-55555', website: 'changed.ph' } })).status).toBe(200)
      const stored = await testDb.collection('invoices').findOne({ _id: invoice._id })
      expect(stored.clinic_snapshot.tin).toBe('987-654-321-00002')
      const header = await invoiceClinic(testDb, stored) // what the PDF and email use
      expect(header.business_tin).toBe('987-654-321-00002'); expect(header.website).toBe('sa-edit.ph')
      const fresh = (await createInvoice(testDb, ctx, body(ids.iloilo))).invoice
      expect(fresh.clinic_snapshot.tin).toBe('555-555-555-55555') // new invoices use the new TIN
    })
    it('BRANCH_TIN_MISSING (422) blocks creating or sending for a branch without a TIN', async () => {
      const e = await createInvoice(testDb, ctx, body(ids.legacy)).catch((x) => x)
      expect(e.code).toBe('BRANCH_TIN_MISSING'); expect(e.status).toBe(422); expect(e.message).toBe('This branch has no TIN yet. Ask the Super Admin to add it.')
      expect(await testDb.collection('invoices').countDocuments({ branch_id: new ObjectId(ids.legacy) })).toBe(0)
    })
  })
})
