// UI contract tests: what the forms send must be accepted by the real server validators, and what the user must fix
// must be caught on the client. (npx vitest run src/pages/owner/billing)
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ObjectId } from 'mongodb'
import ExpenseModal, { computeExpense, expenseErrors, expensePayload, initialExpense, defaultExpenseLines } from './ExpenseModal'
import InvoiceModal, { computeInvoice, invoiceErrors, blankInvoice } from './InvoiceModal'
import { buildExpense } from '../../../../api/_lib/expensesCore.js'
import { buildInvoice } from '../../../../api/_lib/invoicesCore.js'
import { parsePesos, pesosText, peso, dueText } from './financeApi'

const html = (el) => renderToString(el).replace(/<!-- -->/g, '')
const branchId = new ObjectId().toHexString()
const stub = (found = {}) => ({ collection: (n) => ({ findOne: async () => found[n] ?? null, find: () => ({ sort: () => ({ limit: () => ({ project: () => ({ toArray: async () => [] }) }) }) }) }) })

// Fill a form the way a user would, run it through the client check, then through the real server validation.
function fill(base, patch, lines) {
  const f = { ...initialExpense(branchId), ...base, ...patch }
  f.lines = lines || defaultExpenseLines(f.expense_type, f.utility_type)
  return f
}
async function roundTrip(f) {
  const calc = computeExpense(f)
  expect(expenseErrors(f, calc)).toEqual({}) // nothing for the user to fix
  const sent = expensePayload(f, calc)
  const saved = await buildExpense(stub(), sent) // the server accepts exactly what the form sends...
  expect(Number(saved.total_amount)).toBe(calc.total) // ...and agrees with the total the user saw
  return { sent, saved, calc }
}
const set = (lines, vals) => lines.map((l, i) => ({ ...l, ...(vals[i] || {}) }))

describe('Add expense: happy paths accepted by the server', () => {
  it('Electricity (Davao Light): consumption x rate + taxes', async () => {
    const f = fill({ expense_type: 'Utility', utility_type: 'Electricity', vendor_name: 'Davao Light', account_number: '1234 567 890', period_from: '2026-10-12', period_to: '2026-11-11', bill_date: '2026-11-12', due_date: '2026-11-27', prev: '18420', curr: '19015' })
    f.lines = set(f.lines, [{ unit: '11.20' }, { unit: '1085' }])
    const { saved, calc } = await roundTrip(f)
    expect(calc.consumption).toBe(595)
    expect(saved.meter).toMatchObject({ consumption: 595, unit: 'kWh' })
    expect(calc.total).toBe(595 * 1120 + 108500)
  })
  it('Water in m3', async () => {
    const f = fill({ expense_type: 'Utility', utility_type: 'Water', vendor_name: 'Davao City Water District', account_number: '0123-45678', period_from: '2026-10-12', period_to: '2026-11-11', bill_date: '2026-11-12', due_date: '2026-11-27', prev: '412', curr: '431' })
    f.lines = set(f.lines, [{ unit: '32.50' }, { unit: '138.50' }])
    const { saved } = await roundTrip(f)
    expect(saved.meter).toMatchObject({ consumption: 19, unit: 'm3' })
  })
  it('Internet, Rent and Utility-Other', async () => {
    const net = fill({ expense_type: 'Utility', utility_type: 'Internet', vendor_name: 'PLDT Fibr', account_number: '2870 114 592', period_from: '2026-10-12', period_to: '2026-11-11', bill_date: '2026-11-12', due_date: '2026-11-25', plan_name: 'Fibr Unli 1699', speed: '300', contract_end: '2027-03-01' })
    net.lines = set(net.lines, [{ unit: '1699' }, { unit: '200' }])
    expect((await roundTrip(net)).saved.utility_details.speed_mbps).toBe(300)
    const rent = fill({ expense_type: 'Utility', utility_type: 'Rent', vendor_name: 'Sample Realty Corp.', property_unit: 'Main Clinic · Unit 2B', period_from: '2026-11-01', period_to: '2026-11-30', due_date: '2026-11-05', lease_end: '2027-10-31', is_recurring: true })
    rent.lines = set(rent.lines, [{ unit: '35000' }, { unit: '2500' }])
    const r = await roundTrip(rent)
    expect(r.saved.is_recurring).toBe(true); expect(r.calc.total).toBe(3750000)
    const other = fill({ expense_type: 'Utility', utility_type: 'Other', vendor_name: 'Cool Air Services', description: 'Aircon cleaning & repair', bill_date: '2026-11-15', due_date: '2026-11-22' }, undefined, [{ description: 'Aircon cleaning (3 units)', qty: '3', unit: '800' }, { description: 'Parts & labor', qty: '1', unit: '1100' }])
    expect((await roundTrip(other)).calc.total).toBe(350000)
  })
  it('Supplies: items, delivery, discount, paid in cash', async () => {
    const f = fill({ expense_type: 'Supplies', vendor_name: 'OfficeMart Therapy Supplies', receipt_no: 'SI-20931', bill_date: '2026-11-14', category: 'Therapy materials', delivery: '150', payment_status: 'Paid', paid_date: '2026-11-14', payment_method: 'Clinic cash' }, undefined,
      [{ description: 'Sensory balls set', qty: '3', unit: '450' }, { description: 'Visual flash cards', qty: '5', unit: '280' }, { description: 'Non-toxic modeling clay', qty: '12', unit: '65' }, { description: 'Printer paper (ream)', qty: '4', unit: '250' }])
    const { calc, saved } = await roundTrip(f)
    expect(calc.sub).toBe(453000); expect(calc.total).toBe(468000) // the ₱4,680 on the design
    expect(saved.payment_method).toBe('Clinic cash')
  })
})

describe('Add expense: failure paths are caught', () => {
  it('lists every missing required field and blocks a ₱0 total', () => {
    const f = fill({ expense_type: 'Utility', utility_type: 'Electricity', branch_id: '' })
    const e = expenseErrors(f, computeExpense(f))
    expect(Object.keys(e)).toEqual(expect.arrayContaining(['branch_id', 'vendor_name', 'account_number', 'period_from', 'period_to', 'due_date', 'prev', 'curr', 'lines']))
  })
  it('current reading below previous, Paid without a date, supplies without receipt/category', () => {
    const e1 = expenseErrors(...(() => { const f = fill({ expense_type: 'Utility', utility_type: 'Water', vendor_name: 'x', account_number: '1', period_from: '2026-10-01', period_to: '2026-10-31', due_date: '2026-11-05', prev: '500', curr: '400' }); return [f, computeExpense(f)] })())
    expect(e1.curr).toMatch(/lower/)
    const g = fill({ expense_type: 'Supplies', vendor_name: 'x', bill_date: '2026-11-14', payment_status: 'Paid', paid_date: '' })
    const e2 = expenseErrors(g, computeExpense(g))
    expect(Object.keys(e2)).toEqual(expect.arrayContaining(['receipt_no', 'category', 'paid_date']))
  })
})

describe('Add expense modal renders each layout', () => {
  const props = { branches: [{ id: branchId, branch_name: 'Davao Main Branch' }], clinic: { clinic_name: 'TherapyPro Therapy Clinic', business_tin: '123-456-789-000' }, staff: [], onClose() {}, onSaved() {} }
  it('shows the electricity layout with labelled fields and the live total in the footer', () => {
    const out = html(<ExpenseModal {...props} />)
    for (const s of ['Add expense', 'Utility bill', 'Supplies &amp; materials', 'Other expense', 'Biller &amp; billing period', 'Meter reading &amp; charges', 'Davao Main Branch', 'TIN 123-456-789-000', 'Save draft', 'Save expense', 'BILL TOTAL', 'role="dialog"', 'aria-modal="true"']) expect(out).toContain(s)
    expect(out).toMatch(/<label[^>]*for="[^"]+"[^>]*>Account number/) // label tied to its input
  })
})

describe('New invoice', () => {
  const patient = { _id: new ObjectId(), first_name: 'Miguel', last_name: 'Tayao' }
  const appt = new ObjectId()
  const found = { patients: patient, branchs: { _id: new ObjectId(), tin: '456-657-670-00001', branch_name: 'Davao Main Branch' }, appointments: { _id: appt } }
  const base = () => ({ ...blankInvoice({ payment_instructions: 'Pay at the front desk' }), patient: { id: String(patient._id), name: 'Miguel Tayao', record_no: 'PT-0187' }, bc: { name: 'Guardian Name', phone: '0963 539 7681', email: 'guardian@example.com', address: 'Blk 4' }, issue_date: '2026-11-18' })
  it('Session invoice: imported sessions are accepted by the server and totals match', async () => {
    const f = { ...base(), invoice_type: 'Session', guardian: true, discount: '500', lines: [{ service_date: '2026-11-02', description: 'Speech Therapy - Edward', qty: '1', unit: '1500', appointment_id: String(appt) }, { service_date: '2026-11-09', description: 'Speech Therapy - Edward', qty: '1', unit: '1500', appointment_id: String(new ObjectId()) }] }
    const calc = computeInvoice(f)
    expect(invoiceErrors(f, calc, true)).toEqual({})
    expect(calc.total).toBe(300000 - 50000)
    expect(calc.due).toBe('2026-11-25') // Net 7
  })
  it('Custom invoice: free lines, ₱4,500 less ₱500 = ₱4,000.00 (the design)', async () => {
    const f = { ...base(), invoice_type: 'Custom', discount: '500', lines: [{ service_date: '', description: 'Monthly therapy package', qty: '1', unit: '4500', appointment_id: null }] }
    const calc = computeInvoice(f)
    expect(invoiceErrors(f, calc, true)).toEqual({})
    expect(calc.total).toBe(400000)
    const saved = await buildInvoice(stub(found), { patient_id: f.patient.id, invoice_type: 'Custom', billing_contact: { ...f.bc, is_guardian: false }, issue_date: f.issue_date, payment_terms: f.terms, line_items: [{ description: 'Monthly therapy package', quantity: 1, unit_price: 450000 }], discount_amount: 50000, tax_amount: 0, send: true })
    expect(Number(saved.total_amount)).toBe(calc.total)
  })
  it('failure path: nothing to bill, no email when sending, discount over the subtotal, due before issue', () => {
    const empty = { ...base(), bc: { name: 'G', phone: '', email: '', address: '' }, lines: [] }
    expect(Object.keys(invoiceErrors(empty, computeInvoice(empty), true))).toEqual(expect.arrayContaining(['bc_email', 'lines']))
    const over = { ...base(), invoice_type: 'Custom', discount: '9999', lines: [{ service_date: '', description: 'x', qty: '1', unit: '100', appointment_id: null }] }
    expect(invoiceErrors(over, computeInvoice(over), false).discount).toBeTruthy()
    const late = { ...base(), invoice_type: 'Custom', terms: 'Custom', due_date: '2026-11-01', lines: [{ service_date: '', description: 'x', qty: '1', unit: '100', appointment_id: null }] }
    expect(invoiceErrors(late, computeInvoice(late), false).due_date).toBeTruthy()
  })
  it('modal renders with type chips, clinic info read-only, no diagnosis field, and the footer actions', () => {
    const out = html(<MemoryRouter><InvoiceModal clinic={{ clinic_name: 'TherapyPro Therapy Clinic', business_tin: '123' }} onClose={() => {}} onSaved={() => {}} /></MemoryRouter>)
    for (const s of ['New invoice', 'Session invoice', 'Custom', 'Clinic information', 'Edit in Settings', 'Bill someone else (guardian)', 'TOTAL AMOUNT DUE', 'Save draft', 'Create &amp; send', 'Import completed sessions']) expect(out).toContain(s)
    expect(out.toLowerCase()).not.toContain('diagnosis')
    expect(out.toLowerCase()).not.toContain('icd')
  })
})

describe('money and date helpers', () => {
  it('parses pesos to centavos exactly and formats them back', () => {
    expect(parsePesos('1,234.50')).toBe(123450); expect(parsePesos('₱4,500')).toBe(450000); expect(parsePesos('0.1')).toBe(10); expect(parsePesos('')).toBeNull(); expect(parsePesos('abc')).toBeNaN()
    expect(pesosText(123450)).toBe('1234.50'); expect(pesosText(450000)).toBe('4500'); expect(peso(2144800)).toBe('₱21,448')
  })
  it('due text reads naturally and is blank for paid items', () => {
    expect(dueText(9)).toBe('in 9 days'); expect(dueText(1)).toBe('in 1 day'); expect(dueText(0)).toBe('due today'); expect(dueText(-3)).toBe('3 days overdue'); expect(dueText(5, true)).toBe('')
  })
})
