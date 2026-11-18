// Expenses (money out): utility bills, supplies and other clinic costs. Never mixed with patient invoices.
import { addDays } from './reportsRange.js'
import {
  COL, FinanceError, validationError, toOid, oidOrNull, escapeRegex, str, rejectUnknown, requireDay, dayToDate, dateToDay, dayRange,
  lineAmount, sumInts, mny, isCentavos, nextSeq, formatRef, daysUntil, isOverdue, clinicToday, financeAudit,
} from './finance.js'

export const EXPENSE_TYPES = ['Utility', 'Supplies', 'Other']
export const UTILITY_TYPES = ['Electricity', 'Water', 'Internet', 'Rent', 'Other']
export const PAYMENT_METHODS = ['Clinic cash', 'GCash', 'Card', 'Bank transfer', 'Staff paid - reimburse']
const METER_UNIT = { Electricity: 'kWh', Water: 'm3' }
const REF_PREFIX = { Electricity: 'BILL', Water: 'BILL', Internet: 'INT', Rent: 'RENT', Other: 'BILL' }

const ALLOWED = [
  'branch_id', 'expense_type', 'utility_type', 'category', 'vendor_id', 'vendor_name', 'account_number', 'receipt_no', 'description',
  'period_from', 'period_to', 'bill_date', 'due_date', 'meter', 'utility_details', 'line_items', 'subtotal', 'delivery_fee', 'discount',
  'tax_amount', 'total_amount', 'payment_status', 'paid_date', 'payment_method', 'payment_reference', 'purchased_by', 'add_to_inventory',
  'reminder_days_before', 'is_recurring', 'notes',
]

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// Validates a create/update body for one expense and returns the document fields (WITHOUT ids, reference_no or audit
// fields). Every total, consumption and line amount is recomputed here; a client-sent value that disagrees is rejected.
export async function buildExpense(db, body, { now = new Date() } = {}) {
  const e = {}
  rejectUnknown(body, ALLOWED, e)
  const type = body.expense_type
  if (!EXPENSE_TYPES.includes(type)) e.expense_type = 'Choose Utility, Supplies or Other.'
  const utility = type === 'Utility' ? body.utility_type : undefined
  if (type === 'Utility' && !UTILITY_TYPES.includes(utility)) e.utility_type = 'Choose the type of utility.'

  let branchId = null
  try { branchId = toOid(body.branch_id, 'branch_id') } catch { e.branch_id = 'Choose a branch.' }

  // vendor: a saved vendor (copied by name at save time) or a one-off name
  let vendorId = null
  let vendorName = str(body.vendor_name, 120)
  if (body.vendor_id) {
    vendorId = oidOrNull(body.vendor_id)
    const v = vendorId ? await db.collection(COL.vendors).findOne({ _id: vendorId, status: 'Active' }) : null
    if (!v) e.vendor_id = 'Choose an active vendor.'
    else vendorName = v.vendor_name
  }
  if (!vendorName) e.vendor_name = type === 'Supplies' ? 'Enter the supplier or store.' : 'Enter the biller / vendor.'

  const billDay = requireDay(body.bill_date, 'bill_date', e, { optional: type === 'Utility' && utility === 'Rent' })
  const dueDay = requireDay(body.due_date, 'due_date', e, { optional: !(type === 'Utility' && utility !== 'Other') })
  const periodFrom = requireDay(body.period_from, 'period_from', e, { optional: !(type === 'Utility' && utility !== 'Other') })
  const periodTo = requireDay(body.period_to, 'period_to', e, { optional: !(type === 'Utility' && utility !== 'Other') })
  if (periodFrom && periodTo && periodFrom > periodTo) e.period_to = 'The period must not end before it starts.'
  if (billDay && dueDay && dueDay < billDay) e.due_date = 'The due date cannot be before the bill date.'

  const doc = {
    expense_type: type, vendor_name: vendorName, ...(vendorId ? { vendor_id: vendorId } : {}),
    // Rent has no separate bill date on the form: the rental period start is the bill date.
    bill_date: billDay ? dayToDate(billDay) : periodFrom ? dayToDate(periodFrom) : null,
    ...(dueDay ? { due_date: dayToDate(dueDay) } : {}),
    ...(periodFrom ? { period_from: dayToDate(periodFrom) } : {}),
    ...(periodTo ? { period_to: dayToDate(periodTo) } : {}),
  }
  if (branchId) doc.branch_id = branchId
  if (utility) doc.utility_type = utility
  if (str(body.account_number, 60)) doc.account_number = str(body.account_number, 60)
  if (str(body.receipt_no, 60)) doc.receipt_no = str(body.receipt_no, 60)
  if (str(body.description, 200)) doc.description = str(body.description, 200)
  if (str(body.category, 80)) doc.category = str(body.category, 80)
  if (str(body.notes, 1000)) doc.notes = str(body.notes, 1000)

  // ── type specific rules ──
  if (type === 'Utility' && ['Electricity', 'Water', 'Internet'].includes(utility) && !doc.account_number) {
    e.account_number = utility === 'Water' ? 'Enter the account / meter number.' : 'Enter the account number.'
  }
  if (type === 'Utility' && (utility === 'Other' || type === 'Other') && !doc.description) e.description = 'Say what this is for.'
  if (type === 'Other' && !doc.description) e.description = 'Say what this is for.'
  if (type === 'Supplies') {
    if (!doc.category) e.category = 'Choose a category.'
    if (!doc.receipt_no) e.receipt_no = 'Enter the receipt / OR number.'
    if (body.purchased_by) {
      const id = oidOrNull(body.purchased_by)
      if (!id || !(await db.collection(COL.employees).findOne({ _id: id }, { projection: { _id: 1 } }))) e.purchased_by = 'Choose a staff member.'
      else doc.purchased_by = id
    }
    doc.add_to_inventory = !!body.add_to_inventory
  }

  // meter (electricity kWh / water m3): consumption is computed, never trusted
  if (type === 'Utility' && METER_UNIT[utility]) {
    const m = body.meter || {}
    const prev = num(m.previous_reading)
    const cur = num(m.current_reading)
    if (prev === null || prev < 0) e['meter.previous_reading'] = 'Enter the previous reading.'
    if (cur === null || cur < 0) e['meter.current_reading'] = 'Enter the current reading.'
    if (prev !== null && cur !== null) {
      if (cur < prev) e['meter.current_reading'] = 'The current reading cannot be lower than the previous one.'
      else {
        const consumption = Math.round((cur - prev) * 1000) / 1000
        if (num(m.consumption) !== null && Math.abs(m.consumption - consumption) > 0.0005) throw new FinanceError('TOTAL_MISMATCH', 'Consumption does not match the readings.')
        doc.meter = { previous_reading: prev, current_reading: cur, consumption, unit: METER_UNIT[utility] }
      }
    }
  } else if (body.meter) e.meter = 'Meter readings only apply to electricity and water.'

  // internet / rent details
  if (type === 'Utility' && (utility === 'Internet' || utility === 'Rent')) {
    const u = body.utility_details || {}
    const d = {}
    if (utility === 'Internet') {
      if (str(u.plan_name, 80)) d.plan_name = str(u.plan_name, 80)
      if (u.speed_mbps !== undefined && u.speed_mbps !== null && u.speed_mbps !== '') {
        if (!Number.isInteger(u.speed_mbps) || u.speed_mbps <= 0 || u.speed_mbps > 100000) e['utility_details.speed_mbps'] = 'Enter the speed in whole Mbps.'
        else d.speed_mbps = u.speed_mbps
      }
      const ce = requireDay(u.contract_end_date, 'utility_details.contract_end_date', e, { optional: true })
      if (ce) d.contract_end_date = dayToDate(ce)
    } else {
      if (!str(u.property_unit, 120)) e['utility_details.property_unit'] = 'Enter the property / unit.'
      else d.property_unit = str(u.property_unit, 120)
      const le = requireDay(u.lease_end_date, 'utility_details.lease_end_date', e, { optional: true })
      if (le) d.lease_end_date = dayToDate(le)
      doc.is_recurring = !!body.is_recurring
    }
    if (Object.keys(d).length) doc.utility_details = d
  } else if (body.utility_details) e.utility_details = 'Not used for this expense type.'

  // line items: amount = round(quantity x unit_cost) once per line
  const items = Array.isArray(body.line_items) ? body.line_items : []
  if (items.length < 1) e.line_items = type === 'Supplies' ? 'Add at least one item.' : 'Add at least one charge.'
  if (items.length > 100) e.line_items = 'Too many lines.'
  const itemType = type === 'Supplies' ? 'item' : 'charge'
  const lines = []
  items.slice(0, 100).forEach((li, i) => {
    const le = {}
    const desc = str(li?.description, 200)
    const qty = li?.quantity === undefined ? 1 : num(li.quantity)
    const unit = li?.unit_cost
    if (!desc) le.description = 'Required.'
    if (qty === null || qty <= 0 || qty > 1e6) le.quantity = 'Enter a quantity above 0.'
    if (!isCentavos(unit)) le.unit_cost = 'Enter the cost in whole centavos.'
    if (Object.keys(le).length) { for (const [k, v] of Object.entries(le)) e[`line_items.${i}.${k}`] = v; return }
    const amount = lineAmount(qty, unit)
    if (li.amount !== undefined && li.amount !== amount) throw new FinanceError('TOTAL_MISMATCH', `Line ${i + 1} amount does not match quantity x unit cost.`)
    lines.push({ item_type: itemType, description: desc, quantity: qty, unit_cost: mny(unit), amount: mny(amount) })
  })
  doc.line_items = lines

  // adjustments + totals
  const adj = {}
  for (const k of ['delivery_fee', 'discount', 'tax_amount']) {
    const v = body[k] === undefined || body[k] === null || body[k] === '' ? 0 : body[k]
    if (!isCentavos(v)) e[k] = 'Enter a whole amount in centavos.'
    else adj[k] = v
  }
  if (type !== 'Supplies' && adj.delivery_fee) e.delivery_fee = 'Delivery fees only apply to supplies.'
  const subtotal = sumInts(lines.map((l) => l.amount))
  const total = subtotal + (adj.delivery_fee || 0) + (adj.tax_amount || 0) - (adj.discount || 0)
  if (!e.line_items && Object.keys(adj).length === 3) {
    if (total <= 0) e.total_amount = 'The total must be above ₱0.'
    if (body.subtotal !== undefined && body.subtotal !== subtotal) throw new FinanceError('TOTAL_MISMATCH', 'Subtotal does not match the line items.')
    if (body.total_amount !== undefined && body.total_amount !== total) throw new FinanceError('TOTAL_MISMATCH', 'Total does not match the line items.')
    doc.subtotal = mny(subtotal); doc.delivery_fee = mny(adj.delivery_fee); doc.discount = mny(adj.discount); doc.tax_amount = mny(adj.tax_amount); doc.total_amount = mny(total)
  }

  // reminders
  if (body.reminder_days_before !== undefined && body.reminder_days_before !== null && body.reminder_days_before !== '') {
    if (!Number.isInteger(body.reminder_days_before) || body.reminder_days_before < 0 || body.reminder_days_before > 60) e.reminder_days_before = 'Enter 0 to 60 days.'
    else doc.reminder_days_before = body.reminder_days_before
  }

  // payment
  const status = body.payment_status || 'Unpaid'
  if (!['Unpaid', 'Paid'].includes(status)) e.payment_status = 'Choose Unpaid or Paid.'
  doc.payment_status = status
  if (status === 'Paid') {
    const pd = requireDay(body.paid_date, 'paid_date', e)
    if (pd && pd > clinicToday(now)) e.paid_date = 'The paid date cannot be in the future.'
    if (!PAYMENT_METHODS.includes(body.payment_method)) e.payment_method = 'Choose how it was paid.'
    if (pd) doc.paid_date = dayToDate(pd)
    if (PAYMENT_METHODS.includes(body.payment_method)) doc.payment_method = body.payment_method
    if (str(body.payment_reference, 80)) doc.payment_reference = str(body.payment_reference, 80)
  }

  if (Object.keys(e).length) throw validationError(e)
  return doc
}

export async function createExpense(db, ctx, body) {
  const fields = await buildExpense(db, body)
  const branch = await db.collection(COL.branches).findOne({ _id: fields.branch_id }, { projection: { status: 1 } })
  if (!branch) throw validationError({ branch_id: 'Branch not found.' })
  const prefix = fields.expense_type === 'Utility' ? REF_PREFIX[fields.utility_type] : fields.expense_type === 'Supplies' ? 'SUP' : 'EXP'
  const now = new Date()
  // reference_no comes from an atomic counter; the unique index is the backstop (retry on a duplicate).
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference_no = formatRef(prefix, await nextSeq(db, `expense_${prefix}`))
    const doc = { ...fields, reference_no, record_status: 'Active', created_by: ctx.user._id, created_at: now, updated_at: now }
    try {
      const { insertedId } = await db.collection(COL.expenses).insertOne(doc)
      await financeAudit(db, ctx, { action: 'expense.create', entity: 'expense', entityId: insertedId, meta: { reference_no, total_amount: doc.total_amount } })
      return { ...doc, _id: insertedId }
    } catch (err) {
      if (err.code === 11000 && /reference_no/.test(err.message || '')) continue
      throw err
    }
  }
  throw new FinanceError('DUPLICATE', 'Could not allocate a reference number. Please try again.', 409)
}

// ── reading ──────────────────────────────────────────────────────────────────
export function serializeExpense(x, now = new Date()) {
  const unpaid = x.payment_status === 'Unpaid'
  const overdue = isOverdue(x.due_date, unpaid && x.record_status === 'Active', now)
  return {
    id: String(x._id), reference_no: x.reference_no, branch_id: String(x.branch_id), expense_type: x.expense_type, utility_type: x.utility_type || null,
    category: x.category || null, vendor_id: x.vendor_id ? String(x.vendor_id) : null, vendor_name: x.vendor_name, account_number: x.account_number || null,
    receipt_no: x.receipt_no || null, description: x.description || null,
    period_from: dateToDay(x.period_from), period_to: dateToDay(x.period_to), bill_date: dateToDay(x.bill_date), due_date: dateToDay(x.due_date),
    meter: x.meter || null,
    utility_details: x.utility_details ? { ...x.utility_details, contract_end_date: dateToDay(x.utility_details.contract_end_date), lease_end_date: dateToDay(x.utility_details.lease_end_date) } : null,
    line_items: x.line_items || [], subtotal: x.subtotal ?? 0, delivery_fee: x.delivery_fee ?? 0, discount: x.discount ?? 0, tax_amount: x.tax_amount ?? 0, total_amount: Number(x.total_amount),
    payment_status: x.payment_status, status: x.record_status === 'Voided' ? 'Voided' : overdue ? 'Overdue' : x.payment_status,
    due_in_days: x.due_date ? daysUntil(x.due_date, now) : null,
    paid_date: dateToDay(x.paid_date), payment_method: x.payment_method || null, payment_reference: x.payment_reference || null,
    purchased_by: x.purchased_by ? String(x.purchased_by) : null, add_to_inventory: !!x.add_to_inventory, reminder_days_before: x.reminder_days_before ?? null,
    is_recurring: !!x.is_recurring, attachments: (x.attachments || []).map((a, i) => ({ index: i, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes })),
    notes: x.notes || '', record_status: x.record_status, void_reason: x.void_reason || null, created_at: x.created_at,
  }
}

// Builds the Mongo filter from the query string. Search text is regex-escaped; nothing is spread from raw input.
export function expenseFilter(q, { ignoreSegment = false } = {}) {
  const f = { record_status: q.record_status === 'Voided' ? 'Voided' : 'Active' }
  if (q.branch_id) f.branch_id = toOid(q.branch_id, 'branch_id')
  if (!ignoreSegment && q.expense_type) { if (!EXPENSE_TYPES.includes(q.expense_type)) throw validationError({ expense_type: 'Unknown type.' }); f.expense_type = q.expense_type }
  if (q.utility_type) { if (!UTILITY_TYPES.includes(q.utility_type)) throw validationError({ utility_type: 'Unknown utility type.' }); f.utility_type = q.utility_type }
  if (q.category) f.category = str(q.category, 80)
  const status = q.payment_status
  if (status) {
    const today = dayToDate(clinicToday())
    if (status === 'Paid') f.payment_status = 'Paid'
    else if (status === 'Unpaid') f.payment_status = 'Unpaid'
    else if (status === 'Overdue') { f.payment_status = 'Unpaid'; f.due_date = { $lt: today } }
    else throw validationError({ payment_status: 'Unknown status.' })
  }
  if (q.from || q.to) f.bill_date = dayRange(q.from, q.to)
  if (q.q) {
    const rx = new RegExp(escapeRegex(str(q.q, 80)), 'i')
    f.$or = [{ vendor_name: rx }, { reference_no: rx }, { receipt_no: rx }]
  }
  return f
}

export async function listExpenses(db, q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20))
  const filter = expenseFilter(q)
  const [items, total] = await Promise.all([
    db.collection(COL.expenses).find(filter).sort({ bill_date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    db.collection(COL.expenses).countDocuments(filter),
  ])
  const now = new Date()
  return { items: items.map((x) => serializeExpense(x, now)), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
}

// KPI cards + segment counts for the active filters (the segment itself is excluded from the counts).
export async function expenseSummary(db, q) {
  const filter = expenseFilter(q)
  const base = expenseFilter(q, { ignoreSegment: true })
  const [agg, segs] = await Promise.all([
    db.collection(COL.expenses).aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        total: { $sum: '$total_amount' }, count: { $sum: 1 },
        unpaid: { $sum: { $cond: [{ $eq: ['$payment_status', 'Unpaid'] }, '$total_amount', 0] } },
        unpaidCount: { $sum: { $cond: [{ $eq: ['$payment_status', 'Unpaid'] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$payment_status', 'Paid'] }, '$total_amount', 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ['$payment_status', 'Paid'] }, 1, 0] } },
        utilities: { $sum: { $cond: [{ $eq: ['$expense_type', 'Utility'] }, '$total_amount', 0] } },
        nextDue: { $min: { $cond: [{ $eq: ['$payment_status', 'Unpaid'] }, '$due_date', null] } },
      } },
    ]).toArray(),
    db.collection(COL.expenses).aggregate([{ $match: base }, { $group: { _id: '$expense_type', n: { $sum: 1 } } }]).toArray(),
  ])
  const a = agg[0] || { total: 0, count: 0, unpaid: 0, unpaidCount: 0, paid: 0, paidCount: 0, utilities: 0, nextDue: null }
  const counts = { all: 0, Utility: 0, Supplies: 0, Other: 0 }
  for (const s of segs) { counts[s._id] = s.n; counts.all += s.n }
  return {
    total: { amount: Number(a.total), count: a.count },
    unpaid: { amount: Number(a.unpaid), count: a.unpaidCount, next_due_in_days: a.nextDue ? daysUntil(a.nextDue) : null },
    paid: { amount: Number(a.paid), count: a.paidCount },
    utilities: { amount: Number(a.utilities), share_pct: a.total ? Math.round((Number(a.utilities) / Number(a.total)) * 100) : 0 },
    counts,
  }
}

export async function getExpense(db, id) {
  const _id = toOid(id)
  const x = await db.collection(COL.expenses).findOne({ _id })
  if (!x) throw new FinanceError('NOT_FOUND', 'Expense not found.', 404)
  return x
}

// ── updates ──────────────────────────────────────────────────────────────────
export async function updateExpense(db, ctx, id, body) {
  const cur = await getExpense(db, id)
  if (cur.record_status === 'Voided') throw new FinanceError('ALREADY_VOID', 'A voided expense cannot be changed.', 409)
  if (cur.payment_status === 'Paid') throw new FinanceError('ALREADY_PAID', 'A paid expense cannot be edited.', 409)
  if (body.expense_type && body.expense_type !== cur.expense_type) throw validationError({ expense_type: 'The expense type cannot be changed.' })
  const fields = await buildExpense(db, { ...body, expense_type: cur.expense_type, ...(cur.utility_type ? { utility_type: cur.utility_type } : {}) })
  const unset = {}
  for (const k of ['utility_type', 'category', 'vendor_id', 'account_number', 'receipt_no', 'description', 'period_from', 'period_to', 'due_date', 'meter', 'utility_details', 'purchased_by', 'reminder_days_before', 'paid_date', 'payment_method', 'payment_reference', 'notes']) {
    if (!(k in fields)) unset[k] = ''
  }
  const res = await db.collection(COL.expenses).updateOne(
    { _id: cur._id, payment_status: 'Unpaid', record_status: 'Active' },
    { $set: { ...fields, updated_at: new Date() }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
  )
  if (!res.matchedCount) throw new FinanceError('ALREADY_PAID', 'This expense was just paid or voided.', 409)
  await financeAudit(db, ctx, { action: 'expense.update', entity: 'expense', entityId: cur._id })
  return getExpense(db, id)
}

export async function markExpensePaid(db, ctx, id, body, now = new Date()) {
  const cur = await getExpense(db, id)
  const e = {}
  rejectUnknown(body, ['paid_date', 'payment_method', 'payment_reference'], e)
  const pd = requireDay(body.paid_date, 'paid_date', e)
  if (pd && pd > clinicToday(now)) e.paid_date = 'The paid date cannot be in the future.'
  if (!PAYMENT_METHODS.includes(body.payment_method)) e.payment_method = 'Choose how it was paid.'
  if (Object.keys(e).length) throw validationError(e)
  const res = await db.collection(COL.expenses).updateOne(
    { _id: cur._id, payment_status: 'Unpaid', record_status: 'Active' },
    { $set: { payment_status: 'Paid', paid_date: dayToDate(pd), payment_method: body.payment_method, ...(str(body.payment_reference, 80) ? { payment_reference: str(body.payment_reference, 80) } : {}), updated_at: now } },
  )
  if (!res.matchedCount) throw new FinanceError('ALREADY_PAID', cur.record_status === 'Voided' ? 'This expense is void.' : 'This expense is already paid.', 409)
  await financeAudit(db, ctx, { action: 'expense.mark_paid', entity: 'expense', entityId: cur._id, meta: { payment_method: body.payment_method } })
  return getExpense(db, id)
}

export async function voidExpense(db, ctx, id, body) {
  const cur = await getExpense(db, id)
  const reason = str(body?.reason, 300)
  if (reason.length < 3) throw validationError({ reason: 'Tell us why (at least 3 characters).' })
  const res = await db.collection(COL.expenses).updateOne(
    { _id: cur._id, record_status: 'Active' },
    { $set: { record_status: 'Voided', void_reason: reason, voided_by: ctx.user._id, voided_at: new Date(), updated_at: new Date() } },
  )
  if (!res.matchedCount) throw new FinanceError('ALREADY_VOID', 'This expense is already void.', 409)
  await financeAudit(db, ctx, { action: 'expense.void', entity: 'expense', entityId: cur._id })
  return getExpense(db, id)
}

// Most recent non-void bill of the same utility at the same branch, for the "vs last bill" note.
export async function previousBill(db, q) {
  if (!UTILITY_TYPES.includes(q.utility_type)) throw validationError({ utility_type: 'Unknown utility type.' })
  const filter = { record_status: 'Active', expense_type: 'Utility', utility_type: q.utility_type, branch_id: toOid(q.branch_id, 'branch_id') }
  if (q.before) { filter.bill_date = { $lt: dayToDate(q.before) } }
  const x = await db.collection(COL.expenses).find(filter).sort({ bill_date: -1, _id: -1 }).limit(1).toArray()
  if (!x[0]) return { previous: null }
  return { previous: { id: String(x[0]._id), reference_no: x[0].reference_no, bill_date: dateToDay(x[0].bill_date), total_amount: Number(x[0].total_amount), consumption: x[0].meter?.consumption ?? null, unit: x[0].meter?.unit ?? null } }
}

// ── due-date reminders (run daily by Vercel Cron, see api/_lib/routes/expenses-remind.js) ──
// An expense with reminder_days_before = N is reminded exactly once, on the day N days before due_date (Manila).
// The "reminded" marker is claimed atomically BEFORE notifying, so two overlapping cron runs cannot both notify.
export async function dueReminders(db, { now = new Date(), onDue }) {
  const today = clinicToday(now)
  const candidates = await db.collection(COL.expenses).find({
    record_status: 'Active', payment_status: 'Unpaid', due_date: { $ne: null }, reminder_days_before: { $ne: null }, reminder_sent_at: { $exists: false },
  }).limit(500).toArray()
  let sent = 0
  for (const x of candidates) {
    const dueDay = dateToDay(x.due_date)
    const remindDay = addDays(dueDay, -x.reminder_days_before)
    if (today < remindDay || today > dueDay) continue // not time yet, or the due date has already passed
    const claim = await db.collection(COL.expenses).updateOne({ _id: x._id, reminder_sent_at: { $exists: false } }, { $set: { reminder_sent_at: now } })
    if (!claim.matchedCount) continue
    await onDue(x, daysUntil(x.due_date, now))
    sent++
  }
  return { checked: candidates.length, sent }
}

// ── recurring rent: never created silently; the Owner clicks "Create next month's rent" ──
const firstOfNextMonth = (day) => { const [y, m] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-01` }
const clampDay = (ym, d) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, '0')}` }
const lastOfMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}` }

export async function createNextRent(db, ctx, id) {
  const cur = await getExpense(db, id)
  if (cur.record_status !== 'Active' || cur.expense_type !== 'Utility' || cur.utility_type !== 'Rent' || !cur.is_recurring) throw new FinanceError('NOT_RECURRING', 'Only an active recurring rent bill can be repeated.', 409)
  const nextFirst = firstOfNextMonth(dateToDay(cur.period_from))
  const nextYm = nextFirst.slice(0, 7)
  const leaseEnd = cur.utility_details?.lease_end_date ? dateToDay(cur.utility_details.lease_end_date) : null
  if (leaseEnd && nextFirst > leaseEnd) throw new FinanceError('NOT_RECURRING', 'The lease ends before next month.', 409)
  const dup = await db.collection(COL.expenses).findOne({ record_status: 'Active', branch_id: cur.branch_id, utility_type: 'Rent', vendor_name: cur.vendor_name, period_from: dayToDate(nextFirst) }, { projection: { _id: 1 } })
  if (dup) throw new FinanceError('DUPLICATE', 'Next month’s rent has already been created.', 409)
  return createExpense(db, ctx, {
    branch_id: String(cur.branch_id), expense_type: 'Utility', utility_type: 'Rent', vendor_name: cur.vendor_name, ...(cur.vendor_id ? { vendor_id: String(cur.vendor_id) } : {}),
    period_from: nextFirst, period_to: lastOfMonth(nextYm), due_date: clampDay(nextYm, Number(dateToDay(cur.due_date).slice(8))), is_recurring: true,
    utility_details: { property_unit: cur.utility_details?.property_unit, ...(leaseEnd ? { lease_end_date: leaseEnd } : {}) },
    ...(cur.reminder_days_before !== undefined ? { reminder_days_before: cur.reminder_days_before } : {}),
    line_items: (cur.line_items || []).map((l) => ({ description: l.description, quantity: l.quantity, unit_cost: Number(l.unit_cost) })),
    payment_status: 'Unpaid',
  })
}
