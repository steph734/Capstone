// Data layer for the Owner Reports page. Everything is driven by ONE inclusive day range ({ from, to }) plus a
// comparison range; nothing here reads "now" except to label "today" and to clamp the future.
//
// Definitions (the numbers on the page mean exactly this):
//   Gross        = every payment RECORDED in the range (payment_date), paid or still pending. Failed / refunded /
//                  cancelled payments are not counted.
//   Paid         = payments in the range whose status is paid (completed | Paid | paid).
//   Outstanding  = billed but unpaid AT THE END of the range: pending payments dated before the range ends
//                  (not "right now"). Limitation: a payment that was pending at that date but is paid today is not
//                  counted, because `payments` keeps no "paid at" timestamp.
//   Latest growth = growth of gross in the range versus the comparison range (a delta in percentage POINTS is
//                  shown against the growth of the comparison range over the period before it).
// Money is integer centavos end to end (Math.round(amount * 100) inside the pipeline) and only formatted for display.
import { realBookingsOnly } from './bookingCore.js'
import {
  CLINIC_TIMEZONE, rangeBounds, granularityFor, bucketCount, bucketize, bucketLabels, addDays, addMonths, diffDays,
  pctChange, tone, countWeekdays, clinicToday, daysInRange,
} from './reportsRange.js'

export const MODULES = ['revenue', 'attendance', 'patient-growth', 'service-popularity', 'retention', 'staff-efficiency']
export const MODULE_TITLES = {
  revenue: 'Revenue report', attendance: 'Attendance report', 'patient-growth': 'Patient growth report',
  'service-popularity': 'Service popularity report', retention: 'Retention rate report', 'staff-efficiency': 'Staff efficiency report',
}

const PAID = ['completed', 'Paid', 'paid']
const PENDING = ['pending', 'Pending']
const BILLED = [...PAID, ...PENDING]
const INACTIVE_APPT = ['Cancelled']
const TZ = CLINIC_TIMEZONE

const centavos = { $toLong: { $round: [{ $multiply: [{ $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } }, 100] }, 0] } }
const dayOf = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } })
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clinicDay = (d) => fmtDay.format(new Date(d))
const monthIdx = (day) => { const [y, m] = day.split('-').map(Number); return y * 12 + (m - 1) }
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (ym) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const sum = (a) => a.reduce((n, x) => n + x, 0)
const rate = (num, den) => (den ? Math.round((num / den) * 100) : null)

// ── queries (all grouping happens in MongoDB) ────────────────────────────────
async function paymentsByDay(db, range, statuses) {
  const { start, end } = rangeBounds(range.from, range.to)
  const rows = await db.collection('payments').aggregate([
    { $match: { status: { $in: statuses }, payment_for: { $ne: 'subscription' }, payment_date: { $gte: start, $lt: end } } },
    { $group: { _id: dayOf('$payment_date'), value: { $sum: centavos } } },
  ]).toArray()
  return rows.map((r) => ({ day: r._id, value: r.value }))
}

async function outstandingAtEnd(db, range) {
  const { end } = rangeBounds(range.from, range.to)
  const [r] = await db.collection('payments').aggregate([
    { $match: { status: { $in: PENDING }, payment_for: { $ne: 'subscription' }, payment_date: { $lt: end } } },
    { $group: { _id: null, value: { $sum: centavos } } },
  ]).toArray()
  return r?.value || 0
}

const apptMatch = (range, extra = {}) => {
  const { start, end } = rangeBounds(range.from, range.to)
  return { is_archived: { $ne: true }, ...realBookingsOnly, session_date: { $gte: start, $lt: end }, ...extra }
}

async function apptsByDay(db, range, extra = {}) {
  const rows = await db.collection('appointments').aggregate([
    { $match: apptMatch(range, extra) },
    { $group: { _id: dayOf('$session_date'), value: { $sum: 1 } } },
  ]).toArray()
  return rows.map((r) => ({ day: r._id, value: r.value }))
}

async function serviceRows(db, range) {
  const rows = await db.collection('appointments').aggregate([
    { $match: apptMatch(range, { status: { $nin: INACTIVE_APPT } }) },
    { $group: { _id: { $ifNull: ['$session_type', 'Other'] }, bookings: { $sum: 1 } } },
    { $sort: { bookings: -1, _id: 1 } },
  ]).toArray()
  return rows.map((r) => ({ service: r._id === 'Other' ? 'Other' : `${r._id} Therapy`, bookings: r.bookings }))
}

async function staffDirectory(db) {
  const [emps, branches] = await Promise.all([
    db.collection('employees').find({}, { projection: { first_name: 1, last_name: 1, branch_id: 1, status: 1, approved_at: 1 } }).toArray(),
    db.collection('branchs').find({}, { projection: { branch_name: 1 } }).toArray(),
  ])
  const bname = new Map(branches.map((b) => [String(b._id), b.branch_name]))
  return emps.map((e) => ({
    id: String(e._id),
    name: [e.first_name, e.last_name].filter(Boolean).join(' ') || 'Unknown',
    branch: e.branch_id ? bname.get(String(e.branch_id)) || '' : '',
    active: !!e.approved_at && e.status !== 'terminated',
  }))
}

async function efficiencyByEmployee(db, range) {
  const rows = await db.collection('appointments').aggregate([
    { $match: apptMatch(range, { status: { $in: ['Completed', 'Confirmed', 'No Show'] } }) },
    { $group: { _id: '$employee_id', scheduled: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } },
  ]).toArray()
  return rows.filter((r) => r._id).map((r) => ({ employee: String(r._id), scheduled: r.scheduled, completed: r.completed }))
}

async function completionByDay(db, range) {
  const rows = await db.collection('appointments').aggregate([
    { $match: apptMatch(range, { status: { $in: ['Completed', 'Confirmed', 'No Show'] } }) },
    { $group: { _id: dayOf('$session_date'), scheduled: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } },
  ]).toArray()
  return rows.map((r) => ({ day: r._id, scheduled: r.scheduled, completed: r.completed }))
}

// One row per (employee, day) with a time-in: distinct presence.
async function presenceRows(db, range) {
  const rows = await db.collection('attendance').aggregate([
    { $match: { type: 'time_in', is_archived: { $ne: true }, attendance_date: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: { e: '$employee', d: '$attendance_date' } } },
  ]).toArray()
  return rows.map((r) => ({ employee: r._id.e ? String(r._id.e) : null, day: r._id.d })).filter((r) => r.employee)
}

// First non-cancelled appointment day per patient (all time): the roster / "new patient" basis.
async function firstSeenPerPatient(db, upToDay) {
  const { end } = rangeBounds(upToDay, upToDay)
  const rows = await db.collection('appointments').aggregate([
    { $match: { is_archived: { $ne: true }, ...realBookingsOnly, patient_id: { $ne: null }, status: { $nin: INACTIVE_APPT }, session_date: { $lt: end } } },
    { $group: { _id: '$patient_id', first: { $min: '$session_date' } } },
  ]).toArray()
  return rows.map((r) => clinicDay(r.first))
}

// Distinct (patient, day) visits from `fromDay` to the range end.
async function visitRows(db, fromDay, toDay) {
  const { start, end } = rangeBounds(fromDay, toDay)
  const rows = await db.collection('appointments').aggregate([
    { $match: { is_archived: { $ne: true }, ...realBookingsOnly, patient_id: { $ne: null }, status: { $nin: INACTIVE_APPT }, session_date: { $gte: start, $lt: end } } },
    { $group: { _id: { p: '$patient_id', d: dayOf('$session_date') } } },
  ]).toArray()
  return rows.map((r) => ({ patient: String(r._id.p), day: r._id.d }))
}

// ── bucket helpers ───────────────────────────────────────────────────────────
function plan(range) {
  const gran = granularityFor(range.from, range.to)
  return { gran, count: bucketCount(range.from, range.to, gran), labels: bucketLabels(range.from, range.to, gran) }
}
const rawIndex = (day, origin, gran) => {
  if (gran === 'day') return diffDays(origin, day)
  if (gran === 'week') return Math.floor(diffDays(origin, day) / 7)
  return monthIdx(day) - monthIdx(origin)
}

// Retention per bucket i = patients seen in bucket i who were also seen in bucket i-1 / patients seen in bucket i-1.
async function retentionSeries(db, range, p) {
  const lookback = p.gran === 'day' ? addDays(range.from, -1) : p.gran === 'week' ? addDays(range.from, -7) : addMonths(`${range.from.slice(0, 7)}-01`, -1)
  const visits = await visitRows(db, lookback, range.to)
  const by = new Map()
  for (const v of visits) {
    const i = rawIndex(v.day, range.from, p.gran)
    if (i < -1 || i >= p.count) continue
    if (!by.has(i)) by.set(i, new Set())
    by.get(i).add(v.patient)
  }
  const out = []
  for (let i = 0; i < p.count; i++) {
    const prev = by.get(i - 1) || new Set()
    const cur = by.get(i) || new Set()
    let retained = 0
    for (const x of prev) if (cur.has(x)) retained++
    out.push({ label: p.labels[i], retained, lost: prev.size - retained, base: prev.size, rate: rate(retained, prev.size) })
  }
  return out
}

// ── module computations ──────────────────────────────────────────────────────
async function computeModule(db, key, range, ctx) {
  const p = plan(range)
  const today = clinicToday()
  switch (key) {
    case 'revenue': {
      const rows = await paymentsByDay(db, range, BILLED)
      const series = bucketize(rows, range.from, p.gran, p.count)
      const months = monthIdx(range.to) - monthIdx(range.from) + 1
      return { key, metricLabel: 'Months covered', metricValue: months, metricFormat: 'number', series, empty: sum(series) === 0 }
    }
    case 'attendance': {
      const [staff, presence] = await Promise.all([ctx.staff(), presenceRows(db, range)])
      // series = staff check-ins per bucket
      const series = bucketize(presence.map((r) => ({ day: r.day, one: 1 })), range.from, p.gran, p.count, 'one')
      return { key, metricLabel: 'Staff tracked', metricValue: staff.filter((e) => e.active).length, metricFormat: 'number', series, empty: presence.length === 0 }
    }
    case 'patient-growth': {
      const firsts = await firstSeenPerPatient(db, range.to)
      const before = firsts.filter((d) => d < range.from).length
      const inRange = firsts.filter((d) => d >= range.from).map((d) => ({ day: d, one: 1 }))
      const added = bucketize(inRange, range.from, p.gran, p.count, 'one')
      let run = before
      const series = added.map((n) => (run += n))
      const label = range.to >= today ? 'Roster today' : `Roster at ${MONTH_NAMES[Number(range.to.slice(5, 7)) - 1]} ${Number(range.to.slice(8))}`
      return { key, metricLabel: label, metricValue: firsts.length, metricFormat: 'number', series, empty: firsts.length === 0 }
    }
    case 'service-popularity': {
      const rows = await apptsByDay(db, range, { status: { $nin: INACTIVE_APPT } })
      const series = bucketize(rows, range.from, p.gran, p.count)
      return { key, metricLabel: 'Total bookings', metricValue: sum(series), metricFormat: 'number', series, empty: sum(series) === 0 }
    }
    case 'retention': {
      const r = await retentionSeries(db, range, p)
      const last = r[r.length - 1]
      return { key, metricLabel: 'Latest rate', metricValue: last?.rate ?? null, metricFormat: 'pct', series: r.map((x) => x.rate ?? 0), empty: r.every((x) => x.base === 0) }
    }
    case 'staff-efficiency': {
      const [byEmp, byDay] = await Promise.all([efficiencyByEmployee(db, range), completionByDay(db, range)])
      const rates = byEmp.map((e) => rate(e.completed, e.scheduled)).filter((x) => x !== null)
      const avg = rates.length ? Math.round(sum(rates) / rates.length) : null
      const sched = bucketize(byDay, range.from, p.gran, p.count, 'scheduled')
      const done = bucketize(byDay, range.from, p.gran, p.count, 'completed')
      return { key, metricLabel: 'Avg completion', metricValue: avg, metricFormat: 'pct', series: sched.map((s, i) => rate(done[i], s) ?? 0), empty: byEmp.length === 0 }
    }
    default:
      throw new Error(`Unknown module ${key}`)
  }
}

// ── summary ──────────────────────────────────────────────────────────────────
export async function buildSummary(db, range, compare) {
  const p = plan(range)
  const ctx = { staff: (() => { let c; return () => (c ||= staffDirectory(db)) })() }
  const prevOfCompare = { from: addDays(compare.from, -daysInRange(compare.from, compare.to)), to: addDays(compare.from, -1) }

  const [gross, paid, pending, grossCmp, paidCmp, pendingCmp, outNow, outCmp, grossCmp2, modules] = await Promise.all([
    paymentsByDay(db, range, BILLED), paymentsByDay(db, range, PAID), paymentsByDay(db, range, PENDING),
    paymentsByDay(db, compare, BILLED), paymentsByDay(db, compare, PAID), paymentsByDay(db, compare, PENDING),
    outstandingAtEnd(db, range), outstandingAtEnd(db, compare),
    paymentsByDay(db, prevOfCompare, BILLED),
    Promise.all(MODULES.map((k) => computeModule(db, k, range, ctx))),
  ])

  const tot = (rows) => sum(rows.map((r) => r.value))
  const series = (rows) => bucketize(rows, range.from, p.gran, p.count)
  // Comparison series use the SAME granularity and bucket count as the current range.
  const cmpSeries = (rows) => bucketize(rows, compare.from, p.gran, p.count)

  const G = tot(gross), GC = tot(grossCmp), GCC = tot(grossCmp2)
  const growth = pctChange(G, GC)
  const prevGrowth = pctChange(GC, GCC)
  const growthPts = growth !== null && prevGrowth !== null ? Math.round((growth - prevGrowth) * 10) / 10 : null

  const kpis = [
    { key: 'gross', label: 'Total collected (gross)', valueFormat: 'money', value: G, previousValue: GC, changePct: pctChange(G, GC), deltaUnit: 'pct', goodDirection: 'up', series: series(gross), previousSeries: cmpSeries(grossCmp) },
    { key: 'paid', label: 'Paid', valueFormat: 'money', value: tot(paid), previousValue: tot(paidCmp), changePct: pctChange(tot(paid), tot(paidCmp)), deltaUnit: 'pct', goodDirection: 'up', series: series(paid), previousSeries: cmpSeries(paidCmp) },
    { key: 'outstanding', label: 'Outstanding', valueFormat: 'money', value: outNow, previousValue: outCmp, changePct: pctChange(outNow, outCmp), deltaUnit: 'pct', goodDirection: 'down', series: series(pending), previousSeries: cmpSeries(pendingCmp) },
    { key: 'growth', label: 'Latest growth', valueFormat: 'pct', value: growth, previousValue: prevGrowth, changePct: growthPts, deltaUnit: 'pts', goodDirection: 'up', series: series(gross), previousSeries: cmpSeries(grossCmp) },
  ].map((k) => ({ ...k, tone: tone(k.changePct, k.goodDirection) }))

  const empty = kpis[0].value === 0 && modules.every((m) => m.empty)
  return { kpis, modules, granularity: p.gran, labels: p.labels, empty }
}

// ── export tables ────────────────────────────────────────────────────────────
// col.kind: text | number | money (centavos) | pct (whole percent) | pct1 (one decimal)
const col = (key, label, kind = 'text') => ({ key, label, kind })

async function monthlyRows(db, range) {
  // calendar months clipped to the range
  const months = []
  for (let m = `${range.from.slice(0, 7)}-01`; m <= range.to; m = addMonths(m, 1)) {
    months.push({ ym: m.slice(0, 7), from: m < range.from ? range.from : m, to: addDays(addMonths(m, 1), -1) > range.to ? range.to : addDays(addMonths(m, 1), -1) })
  }
  return months
}

export async function buildTable(db, key, range) {
  const ctx = { staff: (() => { let c; return () => (c ||= staffDirectory(db)) })() }
  switch (key) {
    case 'revenue': {
      const [billed, paid, pending] = await Promise.all([paymentsByDay(db, range, BILLED), paymentsByDay(db, range, PAID), paymentsByDay(db, range, PENDING)])
      const months = await monthlyRows(db, range)
      const inM = (rows, m) => sum(rows.filter((r) => r.day >= m.from && r.day <= m.to).map((r) => r.value))
      let prev = null
      const rows = months.map((m) => {
        const gross = inM(billed, m)
        const row = { month: monthLabel(m.ym), gross, paid: inM(paid, m), outstanding: inM(pending, m), growth: prev === null ? null : pctChange(gross, prev) }
        prev = gross
        return row
      })
      return { key, title: MODULE_TITLES[key], cols: [col('month', 'Month'), col('gross', 'Gross', 'money'), col('paid', 'Paid', 'money'), col('outstanding', 'Outstanding', 'money'), col('growth', 'Growth', 'pct1')], rows }
    }
    case 'attendance': {
      const [staff, presence] = await Promise.all([ctx.staff(), presenceRows(db, range)])
      const today = clinicToday()
      const expected = countWeekdays(range.from, range.to < today ? range.to : today) // weekdays so far in the range
      const days = new Map()
      for (const r of presence) days.set(r.employee, (days.get(r.employee) || 0) + 1)
      const rows = staff.filter((e) => e.active).map((e) => ({ name: e.name, branch: e.branch || '—', present: days.get(e.id) || 0, expected, rate: Math.min(100, rate(days.get(e.id) || 0, expected) ?? 0) }))
      rows.sort((a, b) => a.name.localeCompare(b.name))
      return { key, title: MODULE_TITLES[key], cols: [col('name', 'Staff'), col('branch', 'Branch'), col('present', 'Days present', 'number'), col('expected', 'Expected days', 'number'), col('rate', 'Rate', 'pct')], rows }
    }
    case 'patient-growth': {
      const firsts = await firstSeenPerPatient(db, range.to)
      const months = await monthlyRows(db, range)
      let prevTotal = null
      const rows = months.map((m) => {
        const total = firsts.filter((d) => d <= m.to).length
        const added = firsts.filter((d) => d >= m.from && d <= m.to).length
        const row = { month: monthLabel(m.ym), added, total, growth: prevTotal === null ? null : pctChange(total, prevTotal) }
        prevTotal = total
        return row
      })
      return { key, title: MODULE_TITLES[key], cols: [col('month', 'Month'), col('added', 'New patients', 'number'), col('total', 'Total roster', 'number'), col('growth', 'Growth', 'pct1')], rows }
    }
    case 'service-popularity': {
      const list = await serviceRows(db, range)
      const total = sum(list.map((r) => r.bookings))
      return { key, title: MODULE_TITLES[key], cols: [col('service', 'Service'), col('bookings', 'Bookings', 'number'), col('share', 'Share', 'pct')], rows: list.map((r) => ({ ...r, share: rate(r.bookings, total) ?? 0 })) }
    }
    case 'retention': {
      const r = await retentionSeries(db, range, plan(range))
      return { key, title: MODULE_TITLES[key], cols: [col('label', 'Period'), col('retained', 'Retained', 'number'), col('lost', 'Lost', 'number'), col('rate', 'Rate', 'pct')], rows: r.map((x) => ({ label: x.label, retained: x.retained, lost: x.lost, rate: x.rate })) }
    }
    case 'staff-efficiency': {
      const [staff, byEmp] = await Promise.all([ctx.staff(), efficiencyByEmployee(db, range)])
      const byId = new Map(staff.map((e) => [e.id, e]))
      const rows = byEmp.map((e) => ({ name: byId.get(e.employee)?.name || 'Unknown', branch: byId.get(e.employee)?.branch || '—', scheduled: e.scheduled, completed: e.completed, rate: rate(e.completed, e.scheduled) ?? 0 }))
      rows.sort((a, b) => a.name.localeCompare(b.name))
      return { key, title: MODULE_TITLES[key], cols: [col('name', 'Staff'), col('branch', 'Branch'), col('scheduled', 'Scheduled', 'number'), col('completed', 'Completed', 'number'), col('rate', 'Rate', 'pct')], rows }
    }
    default:
      throw new Error(`Unknown module ${key}`)
  }
}

// `module` is a report key, 'all', or 'custom' (then `keys` lists the chosen modules).
export async function buildTables(db, module, range, keys) {
  const list = module === 'all' ? MODULES : module === 'custom' ? keys : [module]
  return Promise.all(list.map((k) => buildTable(db, k, range)))
}

// Indexes the report pipelines rely on (date fields). Best effort, once per server instance.
let indexesEnsured = false
export async function ensureReportIndexes(db) {
  if (indexesEnsured) return
  indexesEnsured = true
  try {
    await Promise.all([
      db.collection('payments').createIndex({ payment_date: 1, status: 1 }),
      db.collection('appointments').createIndex({ session_date: 1, status: 1 }),
      db.collection('attendance').createIndex({ attendance_date: 1, type: 1 }),
    ])
  } catch (err) {
    indexesEnsured = false
    console.error('report indexes:', err.message)
  }
}
