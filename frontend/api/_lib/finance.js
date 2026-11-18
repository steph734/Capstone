// Shared building blocks for the Owner finance features (Expenses = money out, Invoices = money in).
//  * Collection names live here ONLY (the branch collection really is spelled `branchs`).
//  * Money is integer centavos. A line is rounded once, half away from zero; totals are sums of integers.
//  * Dates are BSON dates. A date-only field (bill date, due date, issue date...) is stored as 00:00 in the clinic
//    timezone (Asia/Manila), so "today", overdue and "in N days" are always judged on the Manila calendar.
//  * "Overdue" is never stored: it is derived (unpaid and due before today, Manila).
import { Long, ObjectId } from 'mongodb'
import {
  zonedMidnight, clinicToday, addDays, diffDays, isValidDay,
} from './reportsRange.js'

export const COL = {
  branches: 'branchs', expenses: 'expenses', vendors: 'vendors', invoices: 'invoices', payments: 'payments',
  patients: 'patients', appointments: 'appointments', counters: 'counters', audit: 'financial_audit_logs',
  clinic: 'clinic_settings', employees: 'employees', users: 'users', notifications: 'notifications',
}

export const FINANCE_ROLES = ['Owner', 'Super Admin']

export class FinanceError extends Error {
  constructor(code, message, status = 422, extra = {}) {
    super(message)
    this.code = code
    this.status = status
    this.extra = extra
  }
}
export const validationError = (fields, message = 'Please fix the highlighted fields.') => new FinanceError('VALIDATION_ERROR', message, 422, { fields })

// One error format everywhere: { error, code, fields? }.
export function sendFinanceError(res, err, label) {
  if (err instanceof FinanceError) return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra })
  if (err?.code === 11000) return res.status(409).json({ error: 'That record already exists.', code: 'DUPLICATE' })
  if (err?.code === 121) { console.error(`${label}: document failed the collection validator`, JSON.stringify(err.errInfo?.details || {}).slice(0, 1500)); return res.status(500).json({ error: 'The record did not pass database validation.', code: 'DB_VALIDATION' }) }
  console.error(`${label}:`, err?.message)
  return res.status(err?.status || 500).json({ error: err?.status ? err.message : 'Something went wrong. Please try again.', ...(err?.code ? { code: err.code } : {}) })
}

// ── ids / text ───────────────────────────────────────────────────────────────
export function toOid(value, field = 'id') {
  if (value instanceof ObjectId) return value
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return new ObjectId(value)
  throw validationError({ [field]: 'Invalid id.' })
}
export const oidOrNull = (v) => { try { return v ? toOid(v) : null } catch { return null } }
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ── money (integer centavos) ─────────────────────────────────────────────────
// Rounds half away from zero. The 1e6 pass removes binary floating point noise (e.g. 1.005 * 100).
export function roundHalfAway(x) {
  const n = Math.round(Math.abs(x) * 1e6) / 1e6
  return Math.sign(x) * Math.round(n)
}
export const lineAmount = (quantity, unitCost) => roundHalfAway(Number(quantity) * Number(unitCost))
export const sumInts = (list) => list.reduce((n, x) => n + x, 0)
// The expenses validator wants int/long: anything past int32 is written as a Long so it is never stored as a double.
export const mny = (n) => (Number.isSafeInteger(n) && Math.abs(n) > 2147483647 ? Long.fromNumber(n) : n)
export const isCentavos = (v) => Number.isSafeInteger(v) && v >= 0
export const pesosFromCentavos = (c) => c / 100

// ── dates ────────────────────────────────────────────────────────────────────
export { clinicToday, isValidDay }
// 'YYYY-MM-DD' -> BSON date at Manila midnight.
export const dayToDate = (day) => zonedMidnight(day)
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
export const dateToDay = (d) => (d ? fmtDay.format(new Date(d)) : null)
// Inclusive [from 00:00:00.000, to 23:59:59.999] Manila -> half-open UTC interval [start, end).
export function dayRange(from, to) {
  const f = from || null
  const t = to || null
  if (f && !isValidDay(f)) throw new FinanceError('INVALID_DATE_RANGE', 'Dates must be real days (YYYY-MM-DD).')
  if (t && !isValidDay(t)) throw new FinanceError('INVALID_DATE_RANGE', 'Dates must be real days (YYYY-MM-DD).')
  if (f && t && f > t) throw new FinanceError('INVALID_DATE_RANGE', 'The start date must not be after the end date.')
  return { ...(f ? { $gte: zonedMidnight(f) } : {}), ...(t ? { $lt: zonedMidnight(addDays(t, 1)) } : {}) }
}
// Days from today (Manila) until the date; negative when it is already past.
export const daysUntil = (date, now = new Date()) => (date ? diffDays(clinicToday(now), dateToDay(date)) : null)
export const isOverdue = (dueDate, unpaid, now = new Date()) => !!unpaid && !!dueDate && dateToDay(dueDate) < clinicToday(now)
export function requireDay(value, field, errors, { optional = false } = {}) {
  if (value === undefined || value === null || value === '') { if (!optional) errors[field] = 'Required.'; return null }
  if (!isValidDay(value)) { errors[field] = 'Enter a valid date.'; return null }
  return value
}

// ── tiny schema validator (rejects unknown fields) ───────────────────────────
export function rejectUnknown(body, allowed, errors) {
  for (const k of Object.keys(body || {})) if (!allowed.includes(k)) errors[k] = 'Unknown field.'
}

// ── counters: atomic, never count+1 ──────────────────────────────────────────
export async function nextSeq(db, key, session) {
  const doc = await db.collection(COL.counters).findOneAndUpdate(
    { _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', ...(session ? { session } : {}) },
  )
  return (doc?.value ?? doc).seq
}
export const formatRef = (prefix, n, pad = 4) => `${prefix}-${String(n).padStart(pad, '0')}`

// ── audit trail (who, when, action, record id; never request bodies or patient names) ──
export async function financeAudit(db, ctx, { action, entity, entityId, meta }) {
  await db.collection(COL.audit).insertOne({
    user_id: ctx.user._id, role: ctx.user.role, action, entity, entity_id: entityId, ip: ctx.ip || null, created_at: new Date(),
    ...(meta ? { meta } : {}),
  })
}
