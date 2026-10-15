// Everything the Owner dashboard shows, computed from MongoDB in one pass
// (appointments, payments, patients, employees, attendance, leave requests).
// All figures cover every branch, like the rest of the Owner pages.
const DAY = 24 * 60 * 60 * 1000
const PH_OFFSET_MS = 8 * 60 * 60 * 1000 // Philippines, no DST
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CANCELLED = ['Cancelled', 'No Show', 'Declined', 'Rejected']
const PAID = ['completed', 'Paid', 'paid']
const ACTIVE_WINDOW_DAYS = 60 // same "Active patient" rule as the Owner Patients page

const phDay = (ms) => new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 10)
const dayStart = (ymd) => new Date(`${ymd}T00:00:00+08:00`)

// Percent change, or null when the earlier figure is zero.
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)

export async function buildOwnerDashboard(db) {
  const now = new Date()
  const today = phDay(now.getTime())
  const todayStart = dayStart(today)
  const tomorrowStart = new Date(todayStart.getTime() + DAY)
  const yesterdayStart = new Date(todayStart.getTime() - DAY)
  const monthKey = today.slice(0, 7)
  const monthStart = dayStart(`${monthKey}-01`)
  const weekdayIdx = (new Date(todayStart.getTime() + PH_OFFSET_MS).getUTCDay() + 6) % 7 // Mon = 0
  const weekStart = new Date(todayStart.getTime() - weekdayIdx * DAY)
  const sixMonthsAgo = (() => {
    const d = new Date(todayStart.getTime() + PH_OFFSET_MS)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 5, 1) - PH_OFFSET_MS)
  })()
  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY)
  const nowHm = new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(11, 16)

  const [apptsRecent, patients, employees, attendanceToday, attendanceHist, payments, pendingPayments, pendingLeave, recentPayments, recentAttendance] = await Promise.all([
    db.collection('appointments').find(
      { is_archived: { $ne: true }, session_date: { $gte: new Date(Math.min(sixMonthsAgo.getTime(), activeCutoff.getTime())) } },
      { projection: { patient_id: 1, employee_id: 1, session_date: 1, start_time: 1, end_time: 1, status: 1, patient_name: 1, created_at: 1 } }
    ).toArray(),
    db.collection('patients').find({}, { projection: { first_name: 1, last_name: 1, created_at: 1 } }).toArray(),
    db.collection('employees').find({}, { projection: { status: 1, first_name: 1, last_name: 1 } }).toArray(),
    db.collection('attendance').find({ attendance_date: today, is_archived: { $ne: true } }, { projection: { employee: 1, type: 1 } }).toArray(),
    db.collection('attendance').aggregate([
      { $match: { type: 'time_in', is_archived: { $ne: true }, attendance_date: { $gte: phDay(now.getTime() - 14 * DAY), $lt: today } } },
      { $group: { _id: { d: '$attendance_date', e: '$employee' } } },
      { $group: { _id: '$_id.d', n: { $sum: 1 } } },
    ]).toArray(),
    db.collection('payments').find(
      { status: { $in: PAID }, payment_date: { $gte: sixMonthsAgo } }, { projection: { amount: 1, payment_date: 1 } }
    ).toArray(),
    db.collection('payments').find({ status: 'pending' }, { projection: { amount: 1 } }).toArray(),
    db.collection('leave_request').countDocuments({ status: 'pending', is_archived: { $ne: true } }),
    db.collection('payments').find({ status: { $in: PAID } }, { projection: { amount: 1, method: 1, payment_date: 1, payment_for: 1 } }).sort({ payment_date: -1 }).limit(4).toArray(),
    db.collection('attendance').find({ type: 'time_in', is_archived: { $ne: true } }, { projection: { employee_name: 1, scanned_at: 1 } }).sort({ scanned_at: -1 }).limit(4).toArray(),
  ])

  const live = apptsRecent.filter((a) => !CANCELLED.includes(a.status))
  const inRange = (a, from, to) => { const d = new Date(a.session_date); return d >= from && d < to }
  const todays = live.filter((a) => inRange(a, todayStart, tomorrowStart))
  const yesterdays = live.filter((a) => inRange(a, yesterdayStart, todayStart))
  const pendingToday = todays.filter((a) => a.status === 'Pending').length
  const confirmedToday = todays.filter((a) => a.status === 'Confirmed' || a.status === 'Completed').length

  // Patients: Active / Inactive / New (never booked), as on the Owner Patients page.
  const everBooked = new Set()
  const recentlyActive = new Set()
  for (const a of apptsRecent) {
    if (!a.patient_id || CANCELLED.includes(a.status)) continue
    const k = String(a.patient_id)
    everBooked.add(k)
    if (new Date(a.session_date) >= activeCutoff) recentlyActive.add(k)
  }
  // `apptsRecent` only reaches back far enough for the chart; anyone booked earlier still counts as booked.
  const olderBooked = await db.collection('appointments').distinct('patient_id', { patient_id: { $ne: null }, status: { $nin: CANCELLED }, is_archived: { $ne: true } })
  for (const id of olderBooked) everBooked.add(String(id))
  let active = 0
  let inactive = 0
  let fresh = 0
  for (const p of patients) {
    const k = String(p._id)
    if (!everBooked.has(k)) fresh += 1
    else if (recentlyActive.has(k)) active += 1
    else inactive += 1
  }
  const newThisMonth = patients.filter((p) => p.created_at && new Date(p.created_at) >= monthStart).length
  const newThisWeek = patients.filter((p) => p.created_at && new Date(p.created_at) >= new Date(now.getTime() - 7 * DAY)).length

  // Staff online = clocked in today and not yet clocked out.
  const clockedIn = new Set(attendanceToday.filter((a) => a.type === 'time_in').map((a) => String(a.employee)))
  const clockedOut = new Set(attendanceToday.filter((a) => a.type === 'time_out').map((a) => String(a.employee)))
  const online = [...clockedIn].filter((e) => !clockedOut.has(e))
  const inSession = new Set(todays.filter((a) => a.start_time && a.end_time && a.start_time <= nowHm && nowHm < a.end_time && a.employee_id).map((a) => String(a.employee_id)))
  const workingStaff = employees.filter((e) => ['active', 'on_leave'].includes(e.status)).length
  const avgOnline = attendanceHist.length ? attendanceHist.reduce((n, d) => n + d.n, 0) / attendanceHist.length : null

  // Revenue by month (last 6) and this month vs last month.
  const monthTotals = new Map()
  for (const p of payments) {
    const k = phDay(new Date(p.payment_date).getTime()).slice(0, 7)
    monthTotals.set(k, (monthTotals.get(k) || 0) + (Number(p.amount) || 0))
  }
  const revenueTrend = []
  const base = new Date(todayStart.getTime() + PH_OFFSET_MS)
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1))
    revenueTrend.push({ label: MONTHS[d.getUTCMonth()], value: Math.round((monthTotals.get(d.toISOString().slice(0, 7)) || 0) * 100) / 100 })
  }
  const thisMonthSales = revenueTrend[5].value
  const lastMonthSales = revenueTrend[4].value

  // Appointments per weekday, current week (Mon–Sun).
  const weekly = WEEKDAYS.map((label, i) => {
    const from = new Date(weekStart.getTime() + i * DAY)
    return { label, value: live.filter((a) => inRange(a, from, new Date(from.getTime() + DAY))).length, isToday: i === weekdayIdx }
  })
  const busiest = weekly.reduce((b, d) => (d.value > b.value ? d : b), weekly[0])

  const outstanding = pendingPayments.reduce((n, p) => n + (Number(p.amount) || 0), 0)
  const notClockedIn = Math.max(0, workingStaff - clockedIn.size)

  const operations = [
    todays.length
      ? { title: `${confirmedToday} of ${todays.length} appointments confirmed today`, detail: pendingToday ? `${pendingToday} still pending confirmation` : 'Nothing waiting on confirmation', tone: pendingToday ? 'review' : 'good', pill: pendingToday ? 'Review' : 'Good' }
      : { title: 'No appointments scheduled today', detail: 'Bookings will appear here', tone: 'good', pill: 'Clear' },
    { title: pendingPayments.length ? `${pendingPayments.length} payment${pendingPayments.length === 1 ? '' : 's'} pending` : 'Payments are up to date', detail: pendingPayments.length ? `₱${outstanding.toLocaleString('en-PH')} not yet collected` : 'No pending payments', tone: pendingPayments.length ? 'review' : 'good', pill: pendingPayments.length ? 'Review' : 'OK' },
    { title: `${online.length} of ${workingStaff} staff clocked in`, detail: notClockedIn ? `${notClockedIn} not clocked in yet today` : 'Everyone is clocked in', tone: notClockedIn && workingStaff ? 'review' : 'good', pill: notClockedIn && workingStaff ? 'Review' : 'Good' },
  ]

  const actionItems = [
    outstanding > 0 && { text: `Follow up on ₱${outstanding.toLocaleString('en-PH')} in pending payments`, priority: 'high', path: '/owner/billing' },
    pendingToday > 0 && { text: `${pendingToday} appointment${pendingToday === 1 ? '' : 's'} awaiting confirmation today`, priority: 'medium', path: '/owner/appointments' },
    pendingLeave > 0 && { text: `${pendingLeave} leave request${pendingLeave === 1 ? '' : 's'} awaiting your review`, priority: 'medium', path: '/owner/staff' },
    employees.some((e) => e.status === 'for_review') && { text: `${employees.filter((e) => e.status === 'for_review').length} new hire${employees.filter((e) => e.status === 'for_review').length === 1 ? '' : 's'} waiting for approval`, priority: 'medium', path: '/owner/staff' },
    notClockedIn > 0 && workingStaff > 0 && { text: `${notClockedIn} staff member${notClockedIn === 1 ? '' : 's'} not clocked in today`, priority: 'low', path: '/owner/staff' },
  ].filter(Boolean)

  const method = { gcash: 'GCash', cash: 'Cash', card: 'Card' }
  const activity = [
    ...recentPayments.map((p) => ({ at: p.payment_date, icon: '💳', text: `Payment received — ₱${(Number(p.amount) || 0).toLocaleString('en-PH')}${p.method ? ` (${method[String(p.method).toLowerCase()] || p.method})` : ''}` })),
    ...patients.filter((p) => p.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3)
      .map((p) => ({ at: p.created_at, icon: '👤', text: `New patient registered — ${[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}` })),
    ...recentAttendance.map((a) => ({ at: a.scanned_at, icon: '🧑‍⚕️', text: `${a.employee_name || 'Staff'} clocked in` })),
    ...[...apptsRecent].filter((a) => a.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3)
      .map((a) => ({ at: a.created_at, icon: '📅', text: `Appointment booked — ${a.patient_name || 'a patient'}` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6)

  return {
    generatedAt: now,
    kpis: {
      appointmentsToday: { value: todays.length, pending: pendingToday, yesterday: yesterdays.length, changePct: pct(todays.length, yesterdays.length) },
      activePatients: { value: active, newThisMonth, newThisWeek },
      staffOnline: { value: online.length, inSession: inSession.size, average: avgOnline == null ? null : Math.round(avgOnline * 10) / 10 },
      grossSales: { value: thisMonthSales, lastMonth: lastMonthSales, changePct: pct(thisMonthSales, lastMonthSales) },
    },
    revenueTrend,
    weekly,
    busiest: busiest.value ? { label: busiest.label, value: busiest.value } : null,
    patientMix: { total: patients.length, active, inactive, new: fresh },
    operations,
    actionItems,
    activity,
  }
}
