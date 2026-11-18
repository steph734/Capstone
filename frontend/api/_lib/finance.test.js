// Unit tests for the finance rules that need no database (run: npx vitest run api/_lib/finance.test.js).
import { describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'
import { roundHalfAway, lineAmount, dayRange, dayToDate, dateToDay, isOverdue, daysUntil, escapeRegex } from './finance.js'
import { buildExpense, serializeExpense, expenseFilter } from './expensesCore.js'
import { buildInvoice, serializeInvoice, invoiceFilter } from './invoicesCore.js'
import { sniffMime, checkFile } from './financeFiles.js'

const oid = () => new ObjectId().toHexString()
// A stand-in for the few lookups validation does (vendors, employees, patients, appointments, branches).
const stubDb = (found = {}) => ({ collection: (n) => ({ findOne: async () => found[n] ?? null, find: () => ({ sort: () => ({ limit: () => ({ project: () => ({ toArray: async () => [] }) }) }) }) }) })
const errs = async (p) => { try { await p } catch (e) { return e } return null }

const electricity = () => ({
  branch_id: oid(), expense_type: 'Utility', utility_type: 'Electricity', vendor_name: 'Davao Light', account_number: '1234 567 890',
  period_from: '2026-10-12', period_to: '2026-11-11', bill_date: '2026-11-12', due_date: '2026-11-27',
  meter: { previous_reading: 18420, current_reading: 19015 },
  line_items: [{ description: 'Energy charge', quantity: 595, unit_cost: 1120 }, { description: 'Taxes and fees', unit_cost: 108500 }],
})

describe('money', () => {
  it('rounds half away from zero, once per line, with no float noise', () => {
    expect(roundHalfAway(2.5)).toBe(3)
    expect(roundHalfAway(-2.5)).toBe(-3)
    expect(roundHalfAway(1.005 * 100)).toBe(101)
    expect(lineAmount(595, 1120)).toBe(666400)
    expect(lineAmount(0.5, 1)).toBe(1)
    expect(lineAmount(3, 0.1)).toBe(0) // 0.3 -> 0
  })
})

describe('Manila dates', () => {
  it('range filters are inclusive 00:00:00.000 to 23:59:59.999 Manila, as UTC', () => {
    const r = dayRange('2026-10-01', '2026-10-31')
    expect(r.$gte.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    expect(r.$lt.toISOString()).toBe('2026-10-31T16:00:00.000Z')
    expect(new Date('2026-10-31T15:59:59.999Z') < r.$lt).toBe(true) // last millisecond of Oct 31 Manila
  })
  it('INVALID_DATE_RANGE for reversed or fake dates', () => {
    expect(() => dayRange('2026-10-31', '2026-10-01')).toThrow(/start date/)
    expect(() => dayRange('2026-02-30', null)).toThrow()
  })
  it('overdue is derived around midnight Manila (never stored)', () => {
    const due = dayToDate('2026-11-18') // due Nov 18
    expect(isOverdue(due, true, new Date('2026-11-18T15:59:59Z'))).toBe(false) // 23:59:59 Manila, still due today
    expect(isOverdue(due, true, new Date('2026-11-18T16:00:00Z'))).toBe(true) // 00:00 Nov 19 Manila
    expect(isOverdue(due, false, new Date('2026-12-01T00:00:00Z'))).toBe(false) // paid is never overdue
    expect(daysUntil(due, new Date('2026-11-09T04:00:00Z'))).toBe(9)
    expect(dateToDay(due)).toBe('2026-11-18')
  })
})

describe('expense validation', () => {
  it('computes consumption, line amounts, subtotal and total on the server', async () => {
    const d = await buildExpense(stubDb(), electricity())
    expect(d.meter).toEqual({ previous_reading: 18420, current_reading: 19015, consumption: 595, unit: 'kWh' })
    expect(d.line_items.map((l) => l.amount)).toEqual([666400, 108500])
    expect(d.subtotal).toBe(774900)
    expect(d.total_amount).toBe(774900)
    expect(d.payment_status).toBe('Unpaid')
  })
  it('TOTAL_MISMATCH when the client sends a wrong total, subtotal, line amount or consumption', async () => {
    for (const patch of [{ total_amount: 1 }, { subtotal: 1 }, { line_items: [{ description: 'x', quantity: 2, unit_cost: 100, amount: 999 }] }, { meter: { previous_reading: 1, current_reading: 11, consumption: 99 } }]) {
      const e = await errs(buildExpense(stubDb(), { ...electricity(), ...patch }))
      expect(e?.code).toBe('TOTAL_MISMATCH')
    }
  })
  it('utility_type is required for a Utility expense', async () => {
    const { utility_type, ...rest } = electricity()
    const e = await errs(buildExpense(stubDb(), rest))
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.extra.fields.utility_type).toBeTruthy()
  })
  it('Paid requires paid_date and payment_method; a Paid date cannot be in the future', async () => {
    const e = await errs(buildExpense(stubDb(), { ...electricity(), payment_status: 'Paid' }))
    expect(Object.keys(e.extra.fields)).toEqual(expect.arrayContaining(['paid_date', 'payment_method']))
    const f = await errs(buildExpense(stubDb(), { ...electricity(), payment_status: 'Paid', paid_date: '2999-01-01', payment_method: 'GCash' }, { now: new Date('2026-11-18T04:00:00Z') }))
    expect(f.extra.fields.paid_date).toMatch(/future/)
    const ok = await buildExpense(stubDb(), { ...electricity(), payment_status: 'Paid', paid_date: '2026-11-15', payment_method: 'GCash' }, { now: new Date('2026-11-18T04:00:00Z') })
    expect(ok.payment_method).toBe('GCash')
  })
  it('current reading cannot be below the previous one; water uses m3', async () => {
    const e = await errs(buildExpense(stubDb(), { ...electricity(), meter: { previous_reading: 500, current_reading: 400 } }))
    expect(e.extra.fields['meter.current_reading']).toMatch(/lower/)
    const w = await buildExpense(stubDb(), { ...electricity(), utility_type: 'Water', meter: { previous_reading: 412, current_reading: 431 } })
    expect(w.meter).toMatchObject({ consumption: 19, unit: 'm3' })
  })
  it('supplies: items x unit cost, delivery, discount, tax; receipt and category required', async () => {
    const base = { branch_id: oid(), expense_type: 'Supplies', vendor_name: 'OfficeMart', receipt_no: 'SI-20931', category: 'Therapy materials', bill_date: '2026-11-14', delivery_fee: 15000, discount: 0, line_items: [{ description: 'Sensory balls set', quantity: 3, unit_cost: 45000 }, { description: 'Flash cards', quantity: 5, unit_cost: 28000 }, { description: 'Clay', quantity: 12, unit_cost: 6500 }, { description: 'Paper', quantity: 4, unit_cost: 25000 }] }
    const d = await buildExpense(stubDb(), base)
    expect(d.subtotal).toBe(453000)
    expect(d.total_amount).toBe(468000) // 4,530 + 150 delivery = 4,680
    expect(d.line_items.every((l) => l.item_type === 'item')).toBe(true)
    const e = await errs(buildExpense(stubDb(), { ...base, receipt_no: '', category: '' }))
    expect(Object.keys(e.extra.fields)).toEqual(expect.arrayContaining(['receipt_no', 'category']))
  })
  it('rent needs the property/unit, uses the period start as bill date; internet speed must be whole Mbps', async () => {
    const rent = { branch_id: oid(), expense_type: 'Utility', utility_type: 'Rent', vendor_name: 'Sample Realty', period_from: '2026-11-01', period_to: '2026-11-30', due_date: '2026-11-05', is_recurring: true, utility_details: { property_unit: 'Main Clinic - Unit 2B', lease_end_date: '2027-10-31' }, line_items: [{ description: 'Monthly rent', unit_cost: 3500000 }, { description: 'Association dues', unit_cost: 250000 }] }
    const d = await buildExpense(stubDb(), rent)
    expect(dateToDay(d.bill_date)).toBe('2026-11-01')
    expect(d.total_amount).toBe(3750000)
    expect(d.is_recurring).toBe(true)
    expect((await errs(buildExpense(stubDb(), { ...rent, utility_details: {} }))).extra.fields['utility_details.property_unit']).toBeTruthy()
    const net = { ...electricity(), utility_type: 'Internet', meter: undefined, utility_details: { speed_mbps: 300.5 } }
    delete net.meter
    expect((await errs(buildExpense(stubDb(), net))).extra.fields['utility_details.speed_mbps']).toBeTruthy()
  })
  it('rejects unknown fields and a due date before the bill date', async () => {
    expect((await errs(buildExpense(stubDb(), { ...electricity(), is_admin: true }))).extra.fields.is_admin).toBeTruthy()
    expect((await errs(buildExpense(stubDb(), { ...electricity(), due_date: '2026-11-01' }))).extra.fields.due_date).toBeTruthy()
  })
  it('lists derive Overdue; search text is escaped (no regex injection)', () => {
    const x = { _id: new ObjectId(), branch_id: new ObjectId(), expense_type: 'Utility', vendor_name: 'A', payment_status: 'Unpaid', record_status: 'Active', due_date: dayToDate('2026-11-17'), total_amount: 100 }
    expect(serializeExpense(x, new Date('2026-11-18T04:00:00Z')).status).toBe('Overdue')
    expect(serializeExpense({ ...x, due_date: dayToDate('2026-11-27') }, new Date('2026-11-18T04:00:00Z')).status).toBe('Unpaid')
    const f = expenseFilter({ q: '.*(' })
    expect(f.$or[0].vendor_name.test('.*(')).toBe(true)
    expect(f.$or[0].vendor_name.test('anything')).toBe(false)
    expect(escapeRegex('a.b')).toBe('a\\.b')
  })
})

describe('invoice validation', () => {
  const patientId = new ObjectId()
  const apptId = new ObjectId()
  const found = { patients: { _id: patientId, first_name: 'Miguel', last_name: 'Tayao', PatientID: 'PT-0187' }, branchs: { _id: new ObjectId() }, appointments: { _id: apptId } }
  const base = () => ({ branch_id: oid(), patient_id: String(patientId), invoice_type: 'Custom', billing_contact: { name: 'Guardian', email: 'g@example.com', is_guardian: true }, issue_date: '2026-11-18', payment_terms: 'Net 7', line_items: [{ description: 'Therapy package', quantity: 1, unit_price: 450000 }], discount_amount: 50000, tax_amount: 0 })
  it('recomputes totals and derives the due date from the terms', async () => {
    const f = await buildInvoice(stubDb(found), base())
    expect(f.subtotal).toBe(450000)
    expect(f.total_amount).toBe(400000)
    expect(f.balance_due).toBe(400000)
    expect(dateToDay(f.due_date)).toBe('2026-11-25')
  })
  it('TOTAL_MISMATCH, INVALID_DATE_RANGE and bad discount', async () => {
    expect((await errs(buildInvoice(stubDb(found), { ...base(), total_amount: 1 }))).code).toBe('TOTAL_MISMATCH')
    expect((await errs(buildInvoice(stubDb(found), { ...base(), payment_terms: 'Custom', due_date: '2026-11-01' }))).code).toBe('INVALID_DATE_RANGE')
    expect((await errs(buildInvoice(stubDb(found), { ...base(), discount_amount: 999999 }))).extra.fields.discount_amount).toBeTruthy()
  })
  it('email is required only when sending; session lines must be sessions; custom lines must not be', async () => {
    const noEmail = { ...base(), billing_contact: { name: 'Guardian' } }
    expect((await buildInvoice(stubDb(found), noEmail)).billing_contact.email).toBe('')
    expect((await errs(buildInvoice(stubDb(found), { ...noEmail, send: true }))).extra.fields['billing_contact.email']).toBeTruthy()
    expect((await errs(buildInvoice(stubDb(found), { ...base(), invoice_type: 'Session' }))).extra.fields['line_items.0.appointment_id']).toBeTruthy()
    expect((await errs(buildInvoice(stubDb(found), { ...base(), line_items: [{ description: 'x', unit_price: 1, appointment_id: String(apptId) }] }))).extra.fields['line_items.0.appointment_id']).toBeTruthy()
    const s = await buildInvoice(stubDb(found), { ...base(), invoice_type: 'Session', line_items: [{ description: 'Speech Therapy', unit_price: 150000, appointment_id: String(apptId), service_date: '2026-11-10' }] })
    expect(s.billed_appointment_ids).toHaveLength(1)
  })
  it('never stores a diagnosis field', async () => {
    expect((await errs(buildInvoice(stubDb(found), { ...base(), diagnosis: 'Q90.9' }))).extra.fields.diagnosis).toBe('Unknown field.')
  })
  it('Overdue is derived; a pending invoice due today is not overdue until Manila midnight passes', () => {
    const inv = { _id: new ObjectId(), branch_id: new ObjectId(), patient_id: new ObjectId(), status: 'Pending', due_date: dayToDate('2026-11-18'), issue_date: dayToDate('2026-11-11'), line_items: [], subtotal: 1, discount_amount: 0, tax_amount: 0, total_amount: 1, amount_paid: 0, balance_due: 1 }
    expect(serializeInvoice(inv, new Date('2026-11-18T15:00:00Z')).display_status).toBe('Pending')
    const late = serializeInvoice(inv, new Date('2026-11-18T16:00:00Z'))
    expect(late.display_status).toBe('Overdue')
    expect(late.overdue_days).toBe(1)
  })
  it('Pending / Overdue segments split on today (Manila) and never overlap', () => {
    const p = invoiceFilter({ status: 'Pending' })
    const o = invoiceFilter({ status: 'Overdue' })
    expect(p.status).toBe('Pending'); expect(o.status).toBe('Pending')
    expect(p.due_date.$gte).toEqual(o.due_date.$lt)
  })
})

describe('attachments', () => {
  const pdf = Buffer.from('%PDF-1.4\n...')
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])
  const exe = Buffer.from('MZ\x90\x00\x03', 'latin1') // a Windows executable
  it('recognises PDF, PNG and JPG by their first bytes', () => {
    expect(sniffMime(pdf)).toBe('application/pdf'); expect(sniffMime(png)).toBe('image/png'); expect(sniffMime(jpg)).toBe('image/jpeg')
  })
  it('rejects a renamed .exe even if it claims to be a PDF (415) and files over 5 MB (413)', () => {
    expect(() => checkFile({ buffer: exe, size: exe.length, originalname: 'bill.pdf', mimetype: 'application/pdf' })).toThrow(/Only PDF/)
    try { checkFile({ buffer: pdf, size: 5 * 1024 * 1024 + 1, originalname: 'a.pdf' }) } catch (e) { expect(e.code).toBe('FILE_TOO_LARGE'); expect(e.status).toBe(413) }
    try { checkFile({ buffer: exe, size: 4, originalname: 'a.pdf' }) } catch (e) { expect(e.code).toBe('UNSUPPORTED_FILE'); expect(e.status).toBe(415) }
    expect(checkFile({ buffer: pdf, size: pdf.length, originalname: 'a.pdf' })).toBe('application/pdf')
  })
})
