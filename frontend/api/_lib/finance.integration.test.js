// Integration tests against a REAL MongoDB (transactions, unique indexes, concurrency, validators).
// Opt-in:   FINANCE_INTEGRATION=1 npx vitest run api/_lib/finance.integration.test.js
// It creates a throwaway database named therapypro_test_<timestamp> on the cluster in MONGO_URI, copies the LIVE
// validators of expenses / vendors / payments into it, runs everything there and DROPS it at the end. The real
// `therapypro` database is only read (to copy validators), never written.
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { MongoClient, ObjectId } from 'mongodb'
import { setup } from '../../scripts/finance-setup.mjs'
import { createExpense, listExpenses, expenseSummary, updateExpense, markExpensePaid, voidExpense, previousBill, getExpense, dueReminders, createNextRent } from './expensesCore.js'
import { createInvoice, markInvoicePaid, voidInvoice, sendInvoice, remindInvoice, billableSessions, listInvoices, invoiceSummary } from './invoicesCore.js'
import { createVendor, listVendors } from './financeVendors.js'
import { addAttachment } from './financeFiles.js'
import { dayToDate, dateToDay } from './finance.js'

const RUN = process.env.FINANCE_INTEGRATION === '1'
const d = RUN ? describe : describe.skip

d('finance on a real MongoDB', () => {
  let client; let db; let live
  const ctx = () => ({ db, user: { _id: new ObjectId(), role: 'Owner' }, ip: 't' })
  const ids = {}
  const err = async (p) => { try { await p } catch (e) { return e } return null }

  beforeAll(async () => {
    try { process.loadEnvFile?.('.env') } catch { /* shell env */ }
    client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 })
    await client.connect()
    live = client.db() // the real database: READ ONLY (validators)
    db = client.db(`therapypro_test_${Date.now()}`)
    for (const name of ['expenses', 'vendors', 'payments']) {
      const info = (await live.listCollections({ name }).toArray())[0]
      await db.createCollection(name, { validator: info.options.validator, validationLevel: info.options.validationLevel, validationAction: info.options.validationAction })
    }
    await db.collection('payments').createIndexes([{ key: { PaymentID: 1 }, unique: true, name: 'PaymentID_1' }, { key: { payment_ref: 1 }, unique: true, name: 'uniq_payment_ref', partialFilterExpression: { payment_ref: { $exists: true } } }])
    await setup(db, { apply: true, applyCollMod: true, log: () => {} })
    ids.branch = (await db.collection('branchs').insertOne({ branch_name: 'Davao Main Branch', status: 'Active', tin: '456-657-670-00001', billing_email: 'billing.davao@therapypro.ph', website: 'www.therapypro.ph', payment_instructions: 'Pay at the front desk.', default_invoice_terms: 'Due on the date shown.' })).insertedId
    ids.patient = (await db.collection('patients').insertOne({ first_name: 'Miguel', last_name: 'Tayao', email: 'p@example.com' })).insertedId
    ids.staff = (await db.collection('employees').insertOne({ first_name: 'Edward', last_name: 'Briones', branch_id: ids.branch })).insertedId
    const appt = (n, day) => ({ patient_id: ids.patient, employee_id: ids.staff, status: 'Completed', session_date: dayToDate(day), session_type: 'Speech', therapist_name: 'Edward Briones', session_fee: 1500, is_archived: false, created_at: new Date() })
    const r = await db.collection('appointments').insertMany([appt(1, '2026-11-02'), appt(2, '2026-11-09'), appt(3, '2026-11-12')])
    ids.appts = Object.values(r.insertedIds)
  }, 60000)

  afterAll(async () => { if (db) await db.dropDatabase(); await client?.close() }, 60000)

  const electricity = (over = {}) => ({
    branch_id: String(ids.branch), expense_type: 'Utility', utility_type: 'Electricity', vendor_name: 'Davao Light', account_number: '1234 567 890',
    period_from: '2026-10-12', period_to: '2026-11-11', bill_date: '2026-11-12', due_date: '2026-11-27', meter: { previous_reading: 18420, current_reading: 19015 },
    line_items: [{ description: 'Energy charge', quantity: 595, unit_cost: 1120 }, { description: 'Taxes and fees', unit_cost: 108500 }], ...over,
  })

  describe('expenses', () => {
    it('creates a bill that passes the LIVE validator, with an atomic reference number', async () => {
      const x = await createExpense(db, ctx(), electricity())
      expect(x.reference_no).toBe('BILL-0001')
      expect(Number(x.total_amount)).toBe(774900)
      const water = await createExpense(db, ctx(), electricity({ utility_type: 'Water', vendor_name: 'Davao City Water District', meter: { previous_reading: 412, current_reading: 431 }, line_items: [{ description: 'Water', quantity: 19, unit_cost: 3250 }] }))
      expect(water.reference_no).toBe('BILL-0002')
      expect(water.meter.unit).toBe('m3')
    })
    it('reference_no stays unique under 25 concurrent creates', async () => {
      const made = await Promise.all(Array.from({ length: 25 }, () => createExpense(db, ctx(), electricity({ bill_date: '2026-11-13' }))))
      expect(new Set(made.map((m) => m.reference_no)).size).toBe(25)
    })
    it('supplies, rent, internet and other all pass the live validator', async () => {
      const common = { branch_id: String(ids.branch) }
      const sup = await createExpense(db, ctx(), { ...common, expense_type: 'Supplies', vendor_name: 'OfficeMart', receipt_no: 'SI-20931', category: 'Therapy materials', bill_date: '2026-11-14', purchased_by: String(ids.staff), add_to_inventory: true, delivery_fee: 15000, payment_status: 'Paid', paid_date: '2026-11-14', payment_method: 'Clinic cash', line_items: [{ description: 'Sensory balls', quantity: 3, unit_cost: 45000 }] })
      expect(Number(sup.total_amount)).toBe(150000)
      const rent = await createExpense(db, ctx(), { ...common, expense_type: 'Utility', utility_type: 'Rent', vendor_name: 'Sample Realty', period_from: '2026-11-01', period_to: '2026-11-30', due_date: '2026-11-05', is_recurring: true, utility_details: { property_unit: 'Unit 2B', lease_end_date: '2027-10-31' }, line_items: [{ description: 'Monthly rent', unit_cost: 3500000 }, { description: 'Dues', unit_cost: 250000 }] })
      expect(rent.reference_no).toMatch(/^RENT-/)
      const net = await createExpense(db, ctx(), { ...common, expense_type: 'Utility', utility_type: 'Internet', vendor_name: 'PLDT Fibr', account_number: '2870', period_from: '2026-10-12', period_to: '2026-11-11', bill_date: '2026-11-12', due_date: '2026-11-25', utility_details: { plan_name: 'Fibr Unli 1699', speed_mbps: 300, contract_end_date: '2027-03-01' }, line_items: [{ description: 'Plan', unit_cost: 169900 }, { description: 'Add-ons', unit_cost: 20000 }] })
      expect(net.reference_no).toMatch(/^INT-/)
      const other = await createExpense(db, ctx(), { ...common, expense_type: 'Other', vendor_name: 'Cool Air', description: 'Aircon cleaning', bill_date: '2026-11-15', line_items: [{ description: 'Cleaning', quantity: 3, unit_cost: 80000 }] })
      expect(other.reference_no).toMatch(/^EXP-/)
    })
    it('mark paid once: the second call is ALREADY_PAID; a paid expense cannot be edited', async () => {
      const x = await createExpense(db, ctx(), electricity({ bill_date: '2026-11-16' }))
      const paid = await markExpensePaid(db, ctx(), String(x._id), { paid_date: '2026-11-17', payment_method: 'GCash' })
      expect(paid.payment_status).toBe('Paid')
      expect((await err(markExpensePaid(db, ctx(), String(x._id), { paid_date: '2026-11-17', payment_method: 'GCash' }))).code).toBe('ALREADY_PAID')
      expect((await err(updateExpense(db, ctx(), String(x._id), electricity()))).code).toBe('ALREADY_PAID')
      const two = await Promise.all([1, 2].map(async () => err(markExpensePaid(db, ctx(), String((await createExpense(db, ctx(), electricity({ bill_date: '2026-11-16' })))._id), { paid_date: '2026-11-17', payment_method: 'Card' }))))
      expect(two).toEqual([null, null])
    })
    it('void keeps the record, stores who/when/why and drops it from totals', async () => {
      const before = await expenseSummary(db, { branch_id: String(ids.branch) })
      const x = await createExpense(db, ctx(), electricity({ bill_date: '2026-11-16', line_items: [{ description: 'Big', unit_cost: 9999999 }] }))
      const mid = await expenseSummary(db, { branch_id: String(ids.branch) })
      expect(mid.total.amount).toBe(before.total.amount + 9999999)
      const v = await voidExpense(db, ctx(), String(x._id), { reason: 'Entered twice' })
      expect(v.record_status).toBe('Voided')
      expect(v.void_reason).toBe('Entered twice'); expect(v.voided_by).toBeTruthy(); expect(v.voided_at).toBeTruthy()
      expect((await expenseSummary(db, { branch_id: String(ids.branch) })).total.amount).toBe(before.total.amount)
      expect((await err(voidExpense(db, ctx(), String(x._id), { reason: 'again' }))).code).toBe('ALREADY_VOID')
      expect((await getExpense(db, String(x._id)))._id).toBeTruthy() // never deleted
    })
    it('date filters are inclusive of the last Manila day; Overdue is derived; segments count', async () => {
      const a = await createExpense(db, ctx(), electricity({ bill_date: '2026-09-30', due_date: '2026-10-01', line_items: [{ description: 'a', unit_cost: 100 }] }))
      const b = await createExpense(db, ctx(), electricity({ bill_date: '2026-10-31', due_date: '2026-10-31', line_items: [{ description: 'b', unit_cost: 100 }] }))
      const c = await createExpense(db, ctx(), electricity({ bill_date: '2026-11-01', due_date: '2026-11-02', line_items: [{ description: 'c', unit_cost: 100 }] }))
      const oct = await listExpenses(db, { from: '2026-10-01', to: '2026-10-31', limit: '100' })
      const refs = oct.items.map((i) => i.reference_no)
      expect(refs).toContain(b.reference_no); expect(refs).not.toContain(a.reference_no); expect(refs).not.toContain(c.reference_no)
      const overdue = await listExpenses(db, { payment_status: 'Overdue', limit: '100' })
      expect(overdue.items.every((i) => i.status === 'Overdue')).toBe(true)
      const sum = await expenseSummary(db, {})
      expect(sum.counts.all).toBe(sum.counts.Utility + sum.counts.Supplies + sum.counts.Other)
    })
    it('previous-bill returns the latest earlier bill of the same utility and branch (or null)', async () => {
      const p = await previousBill(db, { utility_type: 'Electricity', branch_id: String(ids.branch), before: '2026-11-13' })
      expect(p.previous.consumption).toBe(595)
      expect((await previousBill(db, { utility_type: 'Water', branch_id: String(new ObjectId()) })).previous).toBeNull()
    })
    it('attachments: a renamed .exe is rejected, PDF accepted, the 6th file refused', async () => {
      const x = await createExpense(db, ctx(), electricity({ bill_date: '2026-11-16' }))
      const pdf = { buffer: Buffer.from('%PDF-1.4 hello'), size: 14, originalname: 'bill.pdf' }
      const exe = { buffer: Buffer.from('MZ\x90\x00', 'latin1'), size: 4, originalname: 'bill.pdf', mimetype: 'application/pdf' }
      expect((await err(addAttachment(db, ctx(), String(x._id), exe))).code).toBe('UNSUPPORTED_FILE')
      for (let i = 0; i < 5; i++) await addAttachment(db, ctx(), String(x._id), pdf)
      expect((await err(addAttachment(db, ctx(), String(x._id), pdf))).code).toBe('VALIDATION_ERROR')
      expect((await getExpense(db, String(x._id))).attachments).toHaveLength(5)
    })
    it('reminders: notified exactly once, only on the day N days before due, never after paid/void', async () => {
      const bill = (over) => createExpense(db, ctx(), electricity({ bill_date: '2026-11-01', reminder_days_before: 3, ...over }))
      const a = await bill({ due_date: '2026-12-10' })
      const early = await dueReminders(db, { now: new Date('2026-12-06T04:00:00Z'), onDue: async () => {} }) // Dec 6 Manila: 4 days before
      expect(early.sent).toBe(0)
      const seen = []
      const onDue = async (x) => { seen.push(x.reference_no) }
      const day = new Date('2026-12-07T04:00:00Z') // Dec 7 Manila = exactly 3 days before Dec 10
      await Promise.all([dueReminders(db, { now: day, onDue }), dueReminders(db, { now: day, onDue })]) // two overlapping cron runs
      expect(seen.filter((r) => r === a.reference_no)).toHaveLength(1)
      await dueReminders(db, { now: new Date('2026-12-08T04:00:00Z'), onDue })
      expect(seen.filter((r) => r === a.reference_no)).toHaveLength(1)
      const paid = await bill({ due_date: '2026-12-10' })
      await markExpensePaid(db, ctx(), String(paid._id), { paid_date: '2026-11-15', payment_method: 'GCash' })
      const gone = await bill({ due_date: '2026-12-10' })
      await voidExpense(db, ctx(), String(gone._id), { reason: 'duplicate' })
      const again = []
      await dueReminders(db, { now: day, onDue: async (x) => again.push(x.reference_no) })
      expect(again).not.toContain(paid.reference_no); expect(again).not.toContain(gone.reference_no)
    })
    it('recurring rent: only on request, next month, once, and not past the lease end', async () => {
      const rent = { branch_id: String(ids.branch), expense_type: 'Utility', utility_type: 'Rent', vendor_name: 'Sample Realty', period_from: '2026-11-01', period_to: '2026-11-30', due_date: '2026-11-05', is_recurring: true, utility_details: { property_unit: 'Unit 2B', lease_end_date: '2026-12-31' }, line_items: [{ description: 'Monthly rent', unit_cost: 3500000 }] }
      const r = await createExpense(db, ctx(), rent)
      const next = await createNextRent(db, ctx(), String(r._id))
      expect(dateToDay(next.period_from)).toBe('2026-12-01'); expect(dateToDay(next.period_to)).toBe('2026-12-31'); expect(dateToDay(next.due_date)).toBe('2026-12-05')
      expect(next.payment_status).toBe('Unpaid'); expect(next.is_recurring).toBe(true)
      expect((await err(createNextRent(db, ctx(), String(r._id)))).code).toBe('DUPLICATE')
      expect((await err(createNextRent(db, ctx(), String(next._id)))).code).toBe('NOT_RECURRING') // January is past the lease end
    })
    it('vendors: seeded, filtered by utility type, duplicates refused, new vendor saved', async () => {
      const el = await listVendors(db, { vendor_type: 'Utility', utility_type: 'Electricity' })
      expect(el.map((v) => v.vendor_name)).toEqual(['Davao Light'])
      expect((await err(createVendor(db, ctx(), { vendor_name: 'davao light', vendor_type: 'Utility', utility_type: 'Electricity' }))).extra.fields.vendor_name).toBeTruthy()
      expect((await createVendor(db, ctx(), { vendor_name: 'PLDT Fibr', vendor_type: 'Utility', utility_type: 'Internet' })).status).toBe('Active')
    })
  })

  describe('invoices', () => {
    const inv = (over = {}) => ({ branch_id: String(ids.branch), patient_id: String(ids.patient), invoice_type: 'Custom', billing_contact: { name: 'Guardian', email: 'g@example.com', is_guardian: true }, issue_date: '2026-11-18', payment_terms: 'Net 7', line_items: [{ description: 'Therapy package', quantity: 1, unit_price: 450000 }], discount_amount: 50000, ...over })
    it('creates INV numbers atomically and recomputes the total', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv())
      expect(invoice.invoice_no).toBe('INV-1001')
      expect(Number(invoice.total_amount)).toBe(400000)
      expect(invoice.status).toBe('Draft')
    })
    it('the same Idempotency-Key returns the original invoice, even for simultaneous requests', async () => {
      const c = ctx()
      const [a, b] = await Promise.all([createInvoice(db, c, inv(), 'key-12345678'), createInvoice(db, c, inv(), 'key-12345678')])
      expect(String(a.invoice._id)).toBe(String(b.invoice._id))
      expect(await db.collection('invoices').countDocuments({ idempotency_key: `${c.user._id}:key-12345678` })).toBe(1)
    })
    it('a session can be on only one live invoice (409), and voiding frees it', async () => {
      const line = { description: 'Speech', unit_price: 150000, appointment_id: String(ids.appts[0]), service_date: '2026-11-02' }
      const first = await createInvoice(db, ctx(), inv({ invoice_type: 'Session', line_items: [line] }))
      const e = await err(createInvoice(db, ctx(), inv({ invoice_type: 'Session', line_items: [line] })))
      expect(e.code).toBe('SESSION_ALREADY_BILLED'); expect(e.status).toBe(409)
      const race = await Promise.all([1, 2].map(() => err(createInvoice(db, ctx(), inv({ invoice_type: 'Session', line_items: [{ ...line, appointment_id: String(ids.appts[1]) }] })))))
      expect(race.filter(Boolean).map((x) => x.code)).toEqual(['SESSION_ALREADY_BILLED'])
      expect((await billableSessions(db, String(ids.patient), {})).map((s) => s.appointment_id)).not.toContain(String(ids.appts[0]))
      await voidInvoice(db, ctx(), String(first.invoice._id), { reason: 'Wrong patient' })
      expect((await billableSessions(db, String(ids.patient), {})).map((s) => s.appointment_id)).toContain(String(ids.appts[0]))
      await createInvoice(db, ctx(), inv({ invoice_type: 'Session', line_items: [line] })) // billable again
    })
    it('Create & send saves first; an email failure keeps the invoice and flags EMAIL_FAILED', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv({ send: true }))
      const r = await sendInvoice(db, ctx(), String(invoice._id), { deliverFn: async () => { throw new Error('brevo down') } })
      expect(r.emailed).toBe(false); expect(r.flag).toBe('EMAIL_FAILED')
      expect(r.invoice.status).toBe('Pending'); expect(r.invoice.sent_at).toBeFalsy()
      const ok = await sendInvoice(db, ctx(), String(invoice._id), { deliverFn: async () => {} })
      expect(ok.emailed).toBe(true); expect(ok.invoice.sent_to).toBe('g@example.com')
    })
    it('remind: once per 24 hours (429), allowed again after', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv({ send: true }))
      const sent = []
      const deliverFn = async () => { sent.push(1) }
      const t0 = new Date('2026-11-18T01:00:00Z')
      await remindInvoice(db, ctx(), String(invoice._id), { now: t0, deliverFn })
      expect((await err(remindInvoice(db, ctx(), String(invoice._id), { now: new Date(t0.getTime() + 3600e3), deliverFn }))).code).toBe('REMINDER_TOO_SOON')
      await remindInvoice(db, ctx(), String(invoice._id), { now: new Date(t0.getTime() + 25 * 3600e3), deliverFn })
      expect(sent).toHaveLength(2)
    })
    it('mark paid updates the invoice AND writes a payments row together; a second attempt is 409', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv({ send: true }))
      const paid = await markInvoicePaid(db, ctx(), String(invoice._id), { paid_date: '2026-11-18', payment_method: 'gcash', payment_reference: 'GC-1' })
      expect(paid.status).toBe('Paid'); expect(Number(paid.amount_paid)).toBe(400000); expect(Number(paid.balance_due)).toBe(0)
      const pay = await db.collection('payments').findOne({ _id: paid.payment_id })
      expect(pay).toMatchObject({ payment_for: 'invoice', amount: 4000, method: 'gcash', status: 'completed' })
      expect(String(pay.invoice_id)).toBe(String(invoice._id))
      const again = await err(markInvoicePaid(db, ctx(), String(invoice._id), { paid_date: '2026-11-18', payment_method: 'cash' }))
      expect(again.code).toBe('INVOICE_NOT_PAYABLE'); expect(again.status).toBe(409)
      expect(await db.collection('payments').countDocuments({ invoice_id: invoice._id })).toBe(1)
    })
    it('rolls back: if the payment cannot be written the invoice stays Pending', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv({ send: true }))
      const info = (await db.listCollections({ name: 'payments' }).toArray())[0]
      const strict = JSON.parse(JSON.stringify(info.options.validator))
      strict.$jsonSchema.properties.payment_for.enum = ['appointment', 'subscription'] // the pre-migration validator
      await db.command({ collMod: 'payments', validator: strict })
      try {
        const e = await err(markInvoicePaid(db, ctx(), String(invoice._id), { paid_date: '2026-11-18', payment_method: 'cash' }))
        expect(e.code).toBe('PAYMENTS_SCHEMA_OUTDATED')
        const after = await db.collection('invoices').findOne({ _id: invoice._id })
        expect(after.status).toBe('Pending'); expect(after.payment_id).toBeUndefined()
        expect(await db.collection('payments').countDocuments({ invoice_id: invoice._id })).toBe(0)
      } finally { await db.command({ collMod: 'payments', validator: info.options.validator }) }
    })
    it('a Pending invoice past its due date lists and sums as Overdue, never Pending', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv({ issue_date: '2026-10-01', payment_terms: 'Net 7', send: true }))
      const overdue = await listInvoices(db, { status: 'Overdue', limit: '100' })
      expect(overdue.items.map((i) => i.id)).toContain(String(invoice._id))
      expect((await listInvoices(db, { status: 'Pending', limit: '100' })).items.map((i) => i.id)).not.toContain(String(invoice._id))
      expect((await invoiceSummary(db, {})).overdue.count).toBeGreaterThan(0)
    })
    it('drafts only: edits to a sent invoice are refused; void needs a reason and only works on Draft/Pending', async () => {
      const { invoice } = await createInvoice(db, ctx(), inv({ send: true }))
      expect((await err(voidInvoice(db, ctx(), String(invoice._id), { reason: '' }))).code).toBe('VALIDATION_ERROR')
      await markInvoicePaid(db, ctx(), String(invoice._id), { paid_date: '2026-11-18', payment_method: 'cash' })
      expect((await err(voidInvoice(db, ctx(), String(invoice._id), { reason: 'oops' }))).code).toBe('INVOICE_NOT_VOIDABLE')
    })
  })
})
