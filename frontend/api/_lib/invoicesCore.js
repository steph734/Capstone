// Invoices (money in): patient invoices only. Clinic costs live in `expenses` and never appear here.
import mongoose from 'mongoose'
import { ObjectId } from 'mongodb'
import {
  COL, FinanceError, validationError, toOid, oidOrNull, escapeRegex, str, rejectUnknown, requireDay, dayToDate, dateToDay, dayRange,
  lineAmount, sumInts, mny, isCentavos, nextSeq, formatRef, daysUntil, isOverdue, clinicToday, financeAudit,
} from './finance.js'
import { addDays } from './reportsRange.js'
import { makePaymentRef } from './paymentRef.js'
import { patientCodeOf } from './patientCode.js'
import { realBookingsOnly } from './bookingCore.js'
import { invalidateReportsCache } from './reportsCache.js'
import { sendEmail } from './brevo.js'
import { buildInvoicePdf } from './invoicePdf.js'

export const INVOICE_TYPES = ['Session', 'Custom']
export const PAYMENT_TERMS = ['Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Custom']
const TERM_DAYS = { 'Due on receipt': 0, 'Net 7': 7, 'Net 15': 15, 'Net 30': 30 }
// UI label -> value the existing `payments` collection accepts
export const PAY_METHODS = ['cash', 'gcash', 'bank_transfer', 'card', 'paymaya']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const REMIND_EVERY_MS = 24 * 60 * 60 * 1000

const ALLOWED = ['branch_id', 'patient_id', 'invoice_type', 'billing_contact', 'issue_date', 'due_date', 'payment_terms', 'line_items', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'payment_instructions', 'notes', 'terms', 'send']

// MongoDB transactions need the client; the native Db exposes it (or fall back to the shared mongoose connection).
export const clientOf = (db) => db.client || mongoose.connection.getClient()
export async function withTxn(db, fn) {
  const session = clientOf(db).startSession()
  try { return await session.withTransaction(() => fn(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }) } finally { await session.endSession() }
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const patientName = (p) => [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')

// Invoice header details. The TIN, billing email, website, payment instructions and default terms come from THIS BRANCH
// (the branchs document); only the clinic name is clinic-wide. There is deliberately no fallback to the old clinic-level
// TIN: a branch without one cannot issue invoices (BRANCH_TIN_MISSING).
export async function clinicInfo(db, branchId) {
  const [clinic, branch] = await Promise.all([
    db.collection(COL.clinic).findOne({ _id: 'clinic' }, { projection: { clinic_name: 1 } }),
    branchId ? db.collection(COL.branches).findOne({ _id: branchId }) : null,
  ])
  return {
    clinic_name: clinic?.clinic_name || 'TherapyPro', business_tin: branch?.tin || '', email: branch?.billing_email || '', website: branch?.website || '', logo_url: '',
    payment_instructions: branch?.payment_instructions || '', default_terms: branch?.default_invoice_terms || '',
    branch_name: branch?.branch_name || '', address: branch?.address || '', phone: branch?.contact_number || '',
  }
}

// What is frozen onto an invoice when it is created, so editing the branch later never changes an old invoice.
export const snapshotOf = (c) => ({ clinic_name: c.clinic_name, tin: c.business_tin, billing_email: c.email, website: c.website, branch_name: c.branch_name, address: c.address, phone: c.phone, snapshot_at: new Date() })
export const TIN_MISSING = () => new FinanceError('BRANCH_TIN_MISSING', 'This branch has no TIN yet. Ask the Super Admin to add it.', 422)
// The header an invoice is shown with: its own snapshot when it has one (older invoices fall back to the live branch).
export async function invoiceClinic(db, inv) {
  const s = inv.clinic_snapshot
  if (!s) return clinicInfo(db, inv.branch_id)
  return { clinic_name: s.clinic_name, business_tin: s.tin, email: s.billing_email, website: s.website, branch_name: s.branch_name, address: s.address, phone: s.phone, payment_instructions: inv.payment_instructions || '', default_terms: inv.terms || '' }
}

// Validates and prices one invoice. Every line amount, subtotal, total and the due date are recomputed here; a
// client-sent total that disagrees is rejected with TOTAL_MISMATCH.
export async function buildInvoice(db, body, { now = new Date() } = {}) {
  const e = {}
  rejectUnknown(body, ALLOWED, e)
  if (!INVOICE_TYPES.includes(body.invoice_type)) e.invoice_type = 'Choose Session invoice or Custom.'

  let patient = null
  const patientId = oidOrNull(body.patient_id)
  if (!patientId) e.patient_id = 'Choose a patient.'
  else {
    patient = await db.collection(COL.patients).findOne({ _id: patientId })
    if (!patient) e.patient_id = 'Patient not found.'
  }

  // branch: given, else the branch of the patient's latest booking, else the first active branch
  let branchId = oidOrNull(body.branch_id)
  if (body.branch_id && !branchId) e.branch_id = 'Invalid branch.'
  if (!branchId && patient) {
    const last = await db.collection(COL.appointments).find({ patient_id: patient._id, employee_id: { $ne: null } }).sort({ session_date: -1 }).limit(1).project({ employee_id: 1 }).toArray()
    const emp = last[0] ? await db.collection(COL.employees).findOne({ _id: last[0].employee_id }, { projection: { branch_id: 1 } }) : null
    branchId = emp?.branch_id || (await db.collection(COL.branches).findOne({ status: 'Active' }, { projection: { _id: 1 } }))?._id || null
  }
  if (branchId && !(await db.collection(COL.branches).findOne({ _id: branchId }, { projection: { _id: 1 } }))) e.branch_id = 'Branch not found.'

  // billing contact (email is only REQUIRED when sending)
  const bc = body.billing_contact && typeof body.billing_contact === 'object' ? body.billing_contact : {}
  const contact = { name: str(bc.name, 120), phone: str(bc.phone, 40), email: str(bc.email, 120).toLowerCase(), address: str(bc.address, 250), is_guardian: !!bc.is_guardian }
  if (!contact.name) e['billing_contact.name'] = 'Enter who to bill.'
  if (contact.email && !EMAIL_RE.test(contact.email)) e['billing_contact.email'] = 'Enter a valid email address.'
  if (body.send === true && !contact.email) e['billing_contact.email'] = 'An email address is required to send the invoice.'

  // dates and terms
  const issueDay = requireDay(body.issue_date ?? clinicToday(now), 'issue_date', e)
  const terms = body.payment_terms || 'Net 7'
  if (!PAYMENT_TERMS.includes(terms)) e.payment_terms = 'Unknown payment terms.'
  let dueDay = null
  if (issueDay) {
    if (terms === 'Custom') dueDay = requireDay(body.due_date, 'due_date', e)
    else if (terms in TERM_DAYS) dueDay = addDays(issueDay, TERM_DAYS[terms]) // the terms decide the due date
  }
  if (issueDay && dueDay && dueDay < issueDay) throw new FinanceError('INVALID_DATE_RANGE', 'The due date must be on or after the issue date.')

  // lines
  const items = Array.isArray(body.line_items) ? body.line_items : []
  if (items.length < 1) e.line_items = 'Add at least one line.'
  if (items.length > 100) e.line_items = 'Too many lines.'
  const lines = []
  const sessionIds = []
  for (const [i, li] of items.slice(0, 100).entries()) {
    const le = {}
    const desc = str(li?.description, 200)
    const qty = li?.quantity === undefined ? 1 : num(li.quantity)
    if (!desc) le.description = 'Required.'
    if (qty === null || qty <= 0 || qty > 1e6) le.quantity = 'Enter a quantity above 0.'
    if (!isCentavos(li?.unit_price)) le.unit_price = 'Enter the price in whole centavos.'
    const sd = li?.service_date ? (/^\d{4}-\d{2}-\d{2}$/.test(li.service_date) ? li.service_date : null) : undefined
    if (sd === null) le.service_date = 'Enter a valid date.'
    let apptId = null
    if (body.invoice_type === 'Session') {
      apptId = oidOrNull(li?.appointment_id)
      if (!apptId) le.appointment_id = 'Session lines must come from a completed session.'
      else if (sessionIds.some((x) => x.equals(apptId))) le.appointment_id = 'This session is on the invoice twice.'
      else if (patient) {
        const a = await db.collection(COL.appointments).findOne({ _id: apptId, patient_id: patient._id, status: 'Completed', is_archived: { $ne: true }, ...realBookingsOnly }, { projection: { _id: 1 } })
        if (!a) le.appointment_id = 'That session is not a completed session of this patient.'
      }
      if (apptId) sessionIds.push(apptId)
    } else if (li?.appointment_id) le.appointment_id = 'Custom invoices cannot import sessions.'
    if (Object.keys(le).length) { for (const [k, v] of Object.entries(le)) e[`line_items.${i}.${k}`] = v; continue }
    const amount = lineAmount(qty, li.unit_price)
    if (li.amount !== undefined && li.amount !== amount) throw new FinanceError('TOTAL_MISMATCH', `Line ${i + 1} amount does not match quantity x price.`)
    lines.push({ ...(sd ? { service_date: dayToDate(sd) } : {}), description: desc, ...(str(li.service_code, 30) ? { service_code: str(li.service_code, 30) } : {}), quantity: qty, unit_price: mny(li.unit_price), amount: mny(amount), ...(apptId ? { appointment_id: apptId } : {}) })
  }

  const discount = body.discount_amount ?? 0
  const tax = body.tax_amount ?? 0
  if (!isCentavos(discount)) e.discount_amount = 'Enter a whole amount in centavos.'
  if (!isCentavos(tax)) e.tax_amount = 'Enter a whole amount in centavos.'
  const subtotal = sumInts(lines.map((l) => l.amount))
  if (isCentavos(discount) && discount > subtotal && !e.line_items) e.discount_amount = 'The discount cannot be more than the subtotal.'
  const total = subtotal - (isCentavos(discount) ? discount : 0) + (isCentavos(tax) ? tax : 0)
  if (!e.line_items && !e.discount_amount && !e.tax_amount) {
    if (body.send === true && total <= 0) e.total_amount = 'The total must be above ₱0 to send.'
    if (body.subtotal !== undefined && body.subtotal !== subtotal) throw new FinanceError('TOTAL_MISMATCH', 'Subtotal does not match the lines.')
    if (body.total_amount !== undefined && body.total_amount !== total) throw new FinanceError('TOTAL_MISMATCH', 'Total does not match the lines.')
  }
  if (Object.keys(e).length) throw validationError(e)

  const clinic = await clinicInfo(db, branchId)
  if (!clinic.business_tin) throw TIN_MISSING()
  return {
    clinic_snapshot: snapshotOf(clinic),
    branch_id: branchId, patient_id: patient._id, patient_name: patientName(patient), patient_record_no: patientCodeOf(patient._id),
    billing_contact: contact, invoice_type: body.invoice_type, issue_date: dayToDate(issueDay), due_date: dayToDate(dueDay), payment_terms: terms,
    // Omitted (never an empty array) when there are no sessions: an empty array is indexed as null and would collide.
    line_items: lines, ...(sessionIds.length ? { billed_appointment_ids: sessionIds } : {}),
    subtotal: mny(subtotal), discount_amount: mny(discount), tax_amount: mny(tax), total_amount: mny(total), amount_paid: 0, balance_due: mny(total),
    payment_instructions: str(body.payment_instructions, 1000) || clinic.payment_instructions || '', notes: str(body.notes, 1000), terms: str(body.terms, 2000) || clinic.default_terms || '',
  }
}

// ── create ───────────────────────────────────────────────────────────────────
// Idempotency-Key: the same key (per user) returns the invoice that the first request created.
export async function createInvoice(db, ctx, body, idemKey) {
  const key = idemKey ? `${ctx.user._id}:${String(idemKey).slice(0, 100)}` : null
  if (key) {
    const prior = await db.collection(COL.invoices).findOne({ idempotency_key: key })
    if (prior) return { invoice: prior, idempotent: true }
  }
  const fields = await buildInvoice(db, body)
  const status = body.send === true ? 'Pending' : 'Draft'
  const now = new Date()
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoice_no = formatRef('INV', await nextSeq(db, 'invoice_no'))
    const doc = { ...fields, invoice_no, status, ...(key ? { idempotency_key: key } : {}), created_by: ctx.user._id, created_at: now, updated_at: now }
    try {
      const { insertedId } = await db.collection(COL.invoices).insertOne(doc)
      await financeAudit(db, ctx, { action: 'invoice.create', entity: 'invoice', entityId: insertedId, meta: { invoice_no, status, total_amount: doc.total_amount } })
      invalidateReportsCache()
      return { invoice: { ...doc, _id: insertedId }, idempotent: false }
    } catch (err) {
      if (err.code === 11000) {
        const m = String(err.message || '')
        if (/uniq_billed_session|billed_appointment_ids/.test(m)) throw new FinanceError('SESSION_ALREADY_BILLED', 'One of these sessions is already on another invoice.', 409)
        if (key && /idempotency_key/.test(m)) { const prior = await db.collection(COL.invoices).findOne({ idempotency_key: key }); if (prior) return { invoice: prior, idempotent: true } }
        if (/invoice_no/.test(m)) continue
      }
      throw err
    }
  }
  throw new FinanceError('DUPLICATE', 'Could not allocate an invoice number. Please try again.', 409)
}

// ── read ─────────────────────────────────────────────────────────────────────
export async function getInvoice(db, id) {
  const inv = await db.collection(COL.invoices).findOne({ _id: toOid(id) })
  if (!inv) throw new FinanceError('NOT_FOUND', 'Invoice not found.', 404)
  return inv
}

export function serializeInvoice(inv, now = new Date()) {
  const overdue = isOverdue(inv.due_date, inv.status === 'Pending', now)
  const due_in_days = inv.status === 'Pending' ? daysUntil(inv.due_date, now) : null
  return {
    id: String(inv._id), invoice_no: inv.invoice_no, branch_id: String(inv.branch_id), patient_id: String(inv.patient_id), patient_name: inv.patient_name || '', patient_record_no: inv.patient_record_no || null,
    billing_contact: inv.billing_contact || {}, invoice_type: inv.invoice_type, issue_date: dateToDay(inv.issue_date), due_date: dateToDay(inv.due_date), payment_terms: inv.payment_terms,
    line_items: (inv.line_items || []).map((l) => ({ service_date: dateToDay(l.service_date), description: l.description, service_code: l.service_code || null, quantity: l.quantity, unit_price: Number(l.unit_price), amount: Number(l.amount), appointment_id: l.appointment_id ? String(l.appointment_id) : null })),
    subtotal: Number(inv.subtotal), discount_amount: Number(inv.discount_amount), tax_amount: Number(inv.tax_amount), total_amount: Number(inv.total_amount),
    amount_paid: Number(inv.amount_paid), balance_due: Number(inv.balance_due),
    status: inv.status, display_status: inv.status === 'Pending' && overdue ? 'Overdue' : inv.status, due_in_days, overdue_days: overdue ? -due_in_days : 0,
    payment_instructions: inv.payment_instructions || '', notes: inv.notes || '', terms: inv.terms || '',
    sent_at: inv.sent_at || null, sent_to: inv.sent_to || null, email_failed: inv.status !== 'Draft' && !inv.sent_at && !!inv.email_error,
    paid_at: inv.paid_at || null, payment_method: inv.payment_method || null, payment_reference: inv.payment_reference || null,
    void_reason: inv.void_reason || null, last_reminded_at: inv.last_reminded_at || null, created_at: inv.created_at,
  }
}

export function invoiceFilter(q, { ignoreStatus = false } = {}) {
  const f = {}
  const status = q.status
  if (status === 'Void') f.status = 'Void'
  else f.status = { $ne: 'Void' }
  if (q.branch_id) f.branch_id = toOid(q.branch_id, 'branch_id')
  if (q.patient_id) f.patient_id = toOid(q.patient_id, 'patient_id')
  if (q.invoice_type) { if (!INVOICE_TYPES.includes(q.invoice_type)) throw validationError({ invoice_type: 'Unknown type.' }); f.invoice_type = q.invoice_type }
  if (q.issued_from || q.issued_to) f.issue_date = dayRange(q.issued_from, q.issued_to)
  if (q.due_from || q.due_to) f.due_date = dayRange(q.due_from, q.due_to)
  if (q.q) { const rx = new RegExp(escapeRegex(str(q.q, 80)), 'i'); f.$or = [{ patient_name: rx }, { invoice_no: rx }] }
  if (!ignoreStatus && status && status !== 'Void') {
    const today = dayToDate(clinicToday())
    const dueClause = f.due_date ? { ...f.due_date } : {}
    if (status === 'Paid' || status === 'Draft') f.status = status
    else if (status === 'Pending') { f.status = 'Pending'; f.due_date = { ...dueClause, $gte: today } } // not yet overdue
    else if (status === 'Overdue') { f.status = 'Pending'; f.due_date = { ...dueClause, $lt: today } }
    else throw validationError({ status: 'Unknown status.' })
    // both the date-range filter and the status split may constrain due_date: keep the tighter bounds
    if (dueClause.$gte && f.due_date.$gte && dueClause.$gte > f.due_date.$gte) f.due_date.$gte = dueClause.$gte
    if (dueClause.$lt && f.due_date.$lt && dueClause.$lt < f.due_date.$lt) f.due_date.$lt = dueClause.$lt
  }
  return f
}

export async function listInvoices(db, q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20))
  const filter = invoiceFilter(q)
  const [items, total] = await Promise.all([
    db.collection(COL.invoices).find(filter).sort({ issue_date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    db.collection(COL.invoices).countDocuments(filter),
  ])
  const now = new Date()
  return { items: items.map((x) => serializeInvoice(x, now)), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
}

// KPI cards and segment counts. Drafts are not billed yet, so they are left out of the money totals.
export async function invoiceSummary(db, q) {
  const base = invoiceFilter(q, { ignoreStatus: true })
  const today = dayToDate(clinicToday())
  const [agg] = await db.collection(COL.invoices).aggregate([
    { $match: base },
    { $group: {
      _id: null,
      billed: { $sum: { $cond: [{ $in: ['$status', ['Pending', 'Paid']] }, '$total_amount', 0] } },
      collected: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$amount_paid', 0] } },
      pending: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Pending'] }, { $gte: ['$due_date', today] }] }, '$balance_due', 0] } },
      overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Pending'] }, { $lt: ['$due_date', today] }] }, '$balance_due', 0] } },
      overdueCount: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Pending'] }, { $lt: ['$due_date', today] }] }, 1, 0] } },
      nAll: { $sum: 1 },
      nPaid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
      nPending: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Pending'] }, { $gte: ['$due_date', today] }] }, 1, 0] } },
    } },
  ]).toArray()
  const a = agg || { billed: 0, collected: 0, pending: 0, overdue: 0, overdueCount: 0, nAll: 0, nPaid: 0, nPending: 0 }
  return {
    billed: Number(a.billed), collected: Number(a.collected), pending: Number(a.pending), overdue: { amount: Number(a.overdue), count: a.overdueCount },
    counts: { all: a.nAll, paid: a.nPaid, pending: a.nPending, overdue: a.overdueCount },
  }
}

// ── update (Draft only) ──────────────────────────────────────────────────────
export async function updateInvoice(db, ctx, id, body) {
  const cur = await getInvoice(db, id)
  if (cur.status !== 'Draft') throw new FinanceError('INVOICE_NOT_EDITABLE', 'Only a draft can be edited. Void it and create a new one instead.', 409)
  const fields = await buildInvoice(db, { ...body, send: undefined })
  try {
    const res = await db.collection(COL.invoices).updateOne({ _id: cur._id, status: 'Draft' }, { $set: { ...fields, updated_at: new Date() }, ...(fields.billed_appointment_ids ? {} : { $unset: { billed_appointment_ids: '' } }) })
    if (!res.matchedCount) throw new FinanceError('INVOICE_NOT_EDITABLE', 'This invoice is no longer a draft.', 409)
  } catch (err) {
    if (err.code === 11000) throw new FinanceError('SESSION_ALREADY_BILLED', 'One of these sessions is already on another invoice.', 409)
    throw err
  }
  await financeAudit(db, ctx, { action: 'invoice.update', entity: 'invoice', entityId: cur._id })
  return getInvoice(db, id)
}

// ── email: send / remind ─────────────────────────────────────────────────────
const peso = (c) => `PHP ${(Number(c) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function emailHtml(inv, clinic, reminder) {
  const lead = reminder ? `This is a friendly reminder that invoice ${esc(inv.invoice_no)} is still unpaid.` : `Please find your invoice ${esc(inv.invoice_no)} attached.`
  return `<div style="font-family:Arial,sans-serif;color:#1b2a24;max-width:560px">
    <h2 style="margin:0 0 8px">${esc(clinic.clinic_name)}</h2>
    <p>Hello ${esc(inv.billing_contact?.name || '')},</p>
    <p>${lead}</p>
    <table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:4px 16px 4px 0;color:#55695f">Invoice</td><td><b>${esc(inv.invoice_no)}</b></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#55695f">Amount due</td><td><b>${peso(inv.balance_due)}</b></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#55695f">Due date</td><td><b>${esc(dateToDay(inv.due_date))}</b></td></tr></table>
    ${inv.payment_instructions ? `<p>${esc(inv.payment_instructions)}</p>` : ''}
    <p style="color:#55695f;font-size:13px">If you have already paid, please ignore this message.</p></div>`
}

async function deliver(db, inv, { reminder = false } = {}) {
  const clinic = await invoiceClinic(db, inv)
  const pdf = buildInvoicePdf(inv, clinic)
  await sendEmail({
    to: inv.billing_contact.email, toName: inv.billing_contact.name,
    subject: `${reminder ? 'Reminder: ' : ''}Invoice ${inv.invoice_no} from ${clinic.clinic_name}`,
    html: emailHtml(inv, clinic, reminder), plain: `${reminder ? 'Reminder: ' : ''}Invoice ${inv.invoice_no} - ${peso(inv.balance_due)} due ${dateToDay(inv.due_date)}.`,
    attachments: [{ name: `${inv.invoice_no}.pdf`, content: Buffer.from(pdf).toString('base64') }],
  })
}

// Saves first, emails second: a failed email never loses the invoice. The result says whether it was sent.
export async function sendInvoice(db, ctx, id, { deliverFn = deliver } = {}) {
  const inv = await getInvoice(db, id)
  if (!['Draft', 'Pending'].includes(inv.status)) throw new FinanceError('INVOICE_NOT_PAYABLE', 'Only draft or pending invoices can be sent.', 409)
  if (!inv.billing_contact?.email) throw validationError({ 'billing_contact.email': 'An email address is required to send the invoice.' })
  if (Number(inv.total_amount) <= 0) throw validationError({ total_amount: 'The total must be above ₱0 to send.' })
  if (inv.status === 'Draft') {
    const live = await clinicInfo(db, inv.branch_id)
    if (!live.business_tin) throw TIN_MISSING()
    const snapshot = snapshotOf(live)
    const r = await db.collection(COL.invoices).updateOne({ _id: inv._id, status: 'Draft' }, { $set: { status: 'Pending', clinic_snapshot: snapshot, updated_at: new Date() } })
    inv.clinic_snapshot = snapshot
    if (!r.matchedCount) throw new FinanceError('INVOICE_NOT_PAYABLE', 'This invoice changed. Reload and try again.', 409)
    inv.status = 'Pending'
  }
  let emailed = true
  try {
    await deliverFn(db, inv)
    await db.collection(COL.invoices).updateOne({ _id: inv._id }, { $set: { sent_at: new Date(), sent_to: inv.billing_contact.email, updated_at: new Date() }, $unset: { email_error: '' } })
  } catch (err) {
    emailed = false
    console.error('invoice email failed:', err?.message)
    await db.collection(COL.invoices).updateOne({ _id: inv._id }, { $set: { email_error: 'EMAIL_FAILED', updated_at: new Date() } })
  }
  await financeAudit(db, ctx, { action: 'invoice.send', entity: 'invoice', entityId: inv._id, meta: { emailed } })
  return { invoice: await getInvoice(db, id), emailed, ...(emailed ? {} : { flag: 'EMAIL_FAILED' }) }
}

// Once per invoice per 24 hours. The slot is claimed atomically BEFORE the email goes out (so two clicks cannot both
// send) and given back if the email fails.
export async function remindInvoice(db, ctx, id, { now = new Date(), deliverFn = deliver } = {}) {
  const inv = await getInvoice(db, id)
  if (inv.status !== 'Pending') throw new FinanceError('INVOICE_NOT_PAYABLE', 'Only pending invoices can be reminded.', 409)
  if (!inv.billing_contact?.email) throw validationError({ 'billing_contact.email': 'There is no email address to remind.' })
  const claim = await db.collection(COL.invoices).updateOne(
    { _id: inv._id, status: 'Pending', $or: [{ last_reminded_at: { $exists: false } }, { last_reminded_at: null }, { last_reminded_at: { $lte: new Date(now.getTime() - REMIND_EVERY_MS) } }] },
    { $set: { last_reminded_at: now } },
  )
  if (!claim.matchedCount) throw new FinanceError('REMINDER_TOO_SOON', 'A reminder was already sent in the last 24 hours.', 429)
  try { await deliverFn(db, inv, { reminder: true }) } catch (err) {
    await db.collection(COL.invoices).updateOne({ _id: inv._id }, inv.last_reminded_at ? { $set: { last_reminded_at: inv.last_reminded_at } } : { $unset: { last_reminded_at: '' } })
    throw new FinanceError('EMAIL_FAILED', 'The reminder could not be sent. Try again.', 502)
  }
  await financeAudit(db, ctx, { action: 'invoice.remind', entity: 'invoice', entityId: inv._id })
  return { invoice: await getInvoice(db, id) }
}

// ── pay / void ───────────────────────────────────────────────────────────────
// Invoice and `payments` row are written in ONE transaction: both happen or neither does.
export async function markInvoicePaid(db, ctx, id, body, now = new Date()) {
  const e = {}
  rejectUnknown(body, ['paid_date', 'payment_method', 'payment_reference'], e)
  const pd = requireDay(body.paid_date, 'paid_date', e)
  if (pd && pd > clinicToday(now)) e.paid_date = 'The paid date cannot be in the future.'
  if (!PAY_METHODS.includes(body.payment_method)) e.payment_method = 'Choose how it was paid.'
  if (Object.keys(e).length) throw validationError(e)
  const _id = toOid(id)
  const reference = str(body.payment_reference, 80)
  let paymentId = null
  try {
    await withTxn(db, async (session) => {
      const inv = await db.collection(COL.invoices).findOne({ _id }, { session })
      if (!inv) throw new FinanceError('NOT_FOUND', 'Invoice not found.', 404)
      if (inv.status !== 'Pending') throw new FinanceError('INVOICE_NOT_PAYABLE', inv.status === 'Paid' ? 'This invoice is already paid.' : 'Only pending invoices can be marked paid.', 409)
      // payments.amount is in pesos in the existing collection; the invoice keeps centavos.
      const pay = {
        PaymentID: `PAY-${new ObjectId().toHexString()}`, payment_for: 'invoice', invoice_id: inv._id, amount: Number(inv.total_amount) / 100, currency: 'PHP',
        method: body.payment_method, payment_date: dayToDate(pd), status: 'completed', payment_ref: makePaymentRef(), created_at: now, updated_at: now,
        ...(reference ? { reference_number: reference } : {}),
      }
      const ins = await db.collection(COL.payments).insertOne(pay, { session })
      paymentId = ins.insertedId
      const up = await db.collection(COL.invoices).updateOne({ _id, status: 'Pending' }, { $set: { status: 'Paid', amount_paid: inv.total_amount, balance_due: 0, paid_at: dayToDate(pd), payment_id: paymentId, payment_method: body.payment_method, ...(reference ? { payment_reference: reference } : {}), updated_at: now } }, { session })
      if (!up.matchedCount) throw new FinanceError('INVOICE_NOT_PAYABLE', 'This invoice is no longer pending.', 409)
    })
  } catch (err) {
    if (err?.code === 121) throw new FinanceError('PAYMENTS_SCHEMA_OUTDATED', 'The payments collection does not accept invoice payments yet. Run the payments collMod from scripts/finance-setup.mjs, then try again.', 500)
    throw err
  }
  await financeAudit(db, ctx, { action: 'invoice.mark_paid', entity: 'invoice', entityId: _id, meta: { payment_method: body.payment_method } })
  invalidateReportsCache()
  return getInvoice(db, id)
}

export async function voidInvoice(db, ctx, id, body) {
  const cur = await getInvoice(db, id)
  const reason = str(body?.reason, 300)
  if (reason.length < 3) throw validationError({ reason: 'Tell us why (at least 3 characters).' })
  if (!['Draft', 'Pending'].includes(cur.status)) throw new FinanceError('INVOICE_NOT_VOIDABLE', 'Only draft or pending invoices can be voided.', 409)
  // Leaving `Draft/Pending` frees the sessions: the unique index only covers non-void invoices.
  const res = await db.collection(COL.invoices).updateOne({ _id: cur._id, status: { $in: ['Draft', 'Pending'] } }, { $set: { status: 'Void', void_reason: reason, voided_by: ctx.user._id, voided_at: new Date(), updated_at: new Date() } })
  if (!res.matchedCount) throw new FinanceError('INVOICE_NOT_VOIDABLE', 'This invoice can no longer be voided.', 409)
  await financeAudit(db, ctx, { action: 'invoice.void', entity: 'invoice', entityId: cur._id })
  invalidateReportsCache()
  return getInvoice(db, id)
}

// ── helpers for the modal ────────────────────────────────────────────────────
export async function searchPatients(db, q) {
  const f = {}
  if (q.q) { const rx = new RegExp(escapeRegex(str(q.q, 60)), 'i'); f.$or = [{ first_name: rx }, { last_name: rx }] }
  const list = await db.collection(COL.patients).find(f).sort({ last_name: 1, first_name: 1 }).limit(30).toArray()
  const yrs = (b) => (b ? Math.floor((Date.now() - new Date(b).getTime()) / 31557600000) : null)
  // the patient's branch = the branch of the therapist on their most recent booking
  const ids = list.map((p) => p._id)
  const appts = ids.length ? await db.collection(COL.appointments).find({ patient_id: { $in: ids }, employee_id: { $ne: null } }, { projection: { patient_id: 1, employee_id: 1 } }).sort({ session_date: -1 }).limit(600).toArray() : []
  const emps = appts.length ? await db.collection(COL.employees).find({ _id: { $in: [...new Set(appts.map((x) => String(x.employee_id)))].map((i) => new ObjectId(i)) } }, { projection: { branch_id: 1 } }).toArray() : []
  const branchOfEmp = new Map(emps.map((e) => [String(e._id), e.branch_id ? String(e.branch_id) : null]))
  const branchOfPatient = new Map()
  for (const x of appts) if (!branchOfPatient.has(String(x.patient_id))) branchOfPatient.set(String(x.patient_id), branchOfEmp.get(String(x.employee_id)) || null)
  return list.map((p) => ({
    id: String(p._id), branch_id: branchOfPatient.get(String(p._id)) || null, name: patientName(p), record_no: patientCodeOf(p._id), age: yrs(p.birthdate),
    // Only what is needed to bill: the patient's own contact, or the guardian's.
    contact: { name: patientName(p), phone: p.contact_number || '', email: p.email || '', address: p.address || '' },
    guardian: p.guardian_first_name ? { name: [p.guardian_first_name, p.guardian_last_name].filter(Boolean).join(' '), phone: p.guardian_contact_number || '', email: p.guardian_email || '', address: p.address || '' } : null,
  }))
}

// Completed, real, not-archived sessions of the patient in the range that are on no live invoice and not already paid.
export async function billableSessions(db, patientId, q) {
  const pid = toOid(patientId, 'patient_id')
  const range = dayRange(q.from, q.to)
  const appts = await db.collection(COL.appointments).find({ patient_id: pid, status: 'Completed', is_archived: { $ne: true }, ...realBookingsOnly, ...(range.$gte || range.$lt ? { session_date: range } : {}) }).sort({ session_date: 1 }).limit(200).toArray()
  if (!appts.length) return []
  const ids = appts.map((a) => a._id)
  const [billed, paid] = await Promise.all([
    db.collection(COL.invoices).find({ billed_appointment_ids: { $in: ids }, status: { $in: ['Draft', 'Pending', 'Paid'] } }, { projection: { billed_appointment_ids: 1 } }).toArray(),
    db.collection(COL.payments).find({ appointment_id: { $in: ids }, status: 'completed' }, { projection: { appointment_id: 1 } }).toArray(),
  ])
  const taken = new Set([...billed.flatMap((b) => b.billed_appointment_ids.map(String)), ...paid.map((p) => String(p.appointment_id))])
  return appts.filter((a) => !taken.has(String(a._id))).map((a) => ({
    appointment_id: String(a._id), service_date: dateToDay(a.session_date), description: `${a.session_type ? `${a.session_type} Therapy` : 'Therapy session'}${a.therapist_name ? ` - ${a.therapist_name}` : ''}`,
    quantity: 1, unit_price: Math.round((Number(a.session_fee) || Number(a.total_due) || 0) * 100),
  }))
}
