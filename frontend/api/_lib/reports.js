// Report engine for /api/reports/:type. Every number comes from the database; nothing here is sample data.
// Dates are Asia/Manila: appointments store session_date as the UTC instant of Manila midnight, so day keys are
// (instant + 8h) as YYYY-MM-DD. "Previous period" = the same number of days right before `from`.
import { ObjectId } from 'mongodb'
import { patientStatus } from './reportStatus.js'
import { decryptSoap } from './noteAccess.js'

const DAY = 86400000
const MANILA = 8 * 3600000
export const dayKey = (d) => new Date(new Date(d).getTime() + MANILA).toISOString().slice(0, 10)
export const todayKey = () => dayKey(new Date())
const keyToDate = (k) => new Date(`${k}T00:00:00+08:00`)
const addDays = (k, n) => dayKey(new Date(keyToDate(k).getTime() + n * DAY))
const diffDays = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / DAY)
const weekStart = (k) => { const d = keyToDate(k); const dow = (new Date(d.getTime() + MANILA).getUTCDay() + 6) % 7; return addDays(k, -dow) }
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null)
const mean = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null }
const round1 = (n) => Math.round(n * 10) / 10

export const STATUS_COLORS = { Completed: '#16a34a', Confirmed: '#0d9488', Pending: '#f59e0b', Cancelled: '#dc2626', 'No Show': '#c2570c' }
const TYPE_COLORS = { Cognitive: '#6366f1', Speech: '#0d9488', Occupational: '#f59e0b', Other: '#94a3b8' }
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const therapyType = (t) => { const s = String(t || '').toLowerCase(); return s.includes('speech') ? 'Speech' : s.includes('occup') ? 'Occupational' : s.includes('cogn') ? 'Cognitive' : 'Other' }
const minutes = (a) => { const [sh, sm] = String(a.start_time || '0:0').split(':').map(Number); const [eh, em] = String(a.end_time || '0:0').split(':').map(Number); const d = eh * 60 + em - (sh * 60 + sm); return d > 0 ? d : 60 }
const acc = (s) => (s.result?.attempts ? Math.min(100, Math.round((Number(s.result.correct || 0) / Number(s.result.attempts)) * 100)) : null)

// ---------- buckets ----------
export function bucketKeyOf(day, kind) { return kind === 'month' ? day.slice(0, 7) : kind === 'year' ? day.slice(0, 4) : kind === 'week' ? weekStart(day) : day }
function bucketList(from, to, kind) {
  const out = []
  let d = from
  while (d <= to) {
    const k = bucketKeyOf(d, kind)
    if (out[out.length - 1] !== k) out.push(k)
    d = addDays(d, 1)
    if (out.length > 800) break
  }
  return out
}
function bucketRange(k, kind) {
  if (kind === 'month') { const [y, m] = k.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return [`${k}-01`, `${k}-${String(last).padStart(2, '0')}`] }
  if (kind === 'year') return [`${k}-01-01`, `${k}-12-31`]
  if (kind === 'week') return [k, addDays(k, 6)]
  return [k, k]
}
function bucketLabel(k, kind) {
  if (kind === 'month') { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) }
  if (kind === 'year') return k
  const d = new Date(`${k}T00:00:00Z`)
  const lab = d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return kind === 'week' ? `Wk ${lab}` : lab
}
const kindFor = (view, trend) => (view === 'annual' ? 'year' : view === 'monthly' ? 'month' : trend ? 'week' : 'day')

// ---------- KPI ----------
const changePct = (cur, prev) => (prev == null || cur == null ? null : prev === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - prev) / prev) * 100))
const kpi = (key, label, value, previous, { good = 'up', suffix = '', icon = 'calendar', tone = 'green', decimals = false } = {}) => ({
  key, label, value, previous, suffix, icon, tone, good, changePct: changePct(value, previous), decimals,
})

// ---------- scope + loading ----------
export async function buildEnv(db, ctx, q) {
  const role = ctx.user.role
  let employeeIds = null
  let therapistName = ctx.user.full_name || ctx.user.username || 'Therapist'
  if (role === 'Therapist') {
    const emp = await db.collection('employees').findOne({ email: String(ctx.user.email || '').toLowerCase() })
    if (!emp) throw Object.assign(new Error('No staff record is linked to this account yet.'), { status: 404 })
    employeeIds = [emp._id]
    therapistName = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || therapistName
  } else if (q.therapistId && ObjectId.isValid(q.therapistId)) {
    employeeIds = [new ObjectId(q.therapistId)]
  }

  const today = todayKey()
  const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to) ? q.to : today
  const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? q.from : addDays(to, -29)
  const len = Math.max(1, diffDays(from, to) + 1)
  const prev = { from: addDays(from, -len), to: addDays(from, -1) }
  const view = ['daily', 'monthly', 'annual'].includes(q.view) ? q.view : 'daily'
  const patientId = ObjectId.isValid(q.patientId) ? String(q.patientId) : ''
  const type = ['Cognitive', 'Speech', 'Occupational'].includes(q.therapyType) ? q.therapyType : ''

  const apptFilter = { is_archived: { $ne: true }, ...(employeeIds ? { employee_id: { $in: employeeIds } } : {}) }
  const allAppts = (await db.collection('appointments').find(apptFilter).toArray()).map((a) => ({ ...a, _day: dayKey(a.session_date), _pid: String(a.patient_id), _type: therapyType(a.session_type), _id: String(a._id) }))
  const scopePatientIds = [...new Set(allAppts.map((a) => a._pid))]
  const scopeAppts = allAppts.filter((a) => (!patientId || a._pid === patientId) && (!type || a._type === type))
  const pOids = scopePatientIds.map((id) => new ObjectId(id))
  const patients = await db.collection('patients').find({ _id: { $in: pOids } }, { projection: { first_name: 1, last_name: 1, birthdate: 1, guardian_first_name: 1, guardian_last_name: 1 } }).toArray()
  const patientById = new Map(patients.map((p) => [String(p._id), p]))
  const nameOf = (id) => { const p = patientById.get(id); return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : (allAppts.find((a) => a._pid === id)?.patient_name || 'Patient') }

  const [games, sessions, assignments, badges, paoProfiles] = await Promise.all([
    db.collection('games').find({}).project({ name: 1, therapy_type: 1 }).toArray(),
    db.collection('game_sessions').find({ patient_id: { $in: pOids }, status: 'completed' }).toArray(),
    db.collection('exercise_assignments').find({ patient_id: { $in: pOids }, is_archived: { $ne: true }, ...(employeeIds ? { employee_id: { $in: employeeIds } } : {}) }).toArray(),
    db.collection('patient_badges').find({ patient_id: { $in: pOids } }).toArray(),
    db.collection('pao_profiles').find({ patient_id: { $in: pOids } }).project({ patient_id: 1, level: 1 }).toArray(),
  ])
  const gameById = new Map(games.map((g) => [String(g._id), g]))
  const gameByName = new Map(games.map((g) => [String(g.name).toLowerCase(), g]))
  const skillOf = (g) => (String(g?.therapy_type || '').toLowerCase().startsWith('speech') ? 'Speech & Language' : 'Cognitive')
  const gsessions = sessions
    .filter((s) => !patientId || String(s.patient_id) === patientId)
    .map((s) => ({ ...s, _pid: String(s.patient_id), _day: dayKey(s.completed_at || s.started_at), _game: gameById.get(String(s.game_id)), _acc: acc(s) }))
  const allAssign = assignments.filter((a) => !patientId || String(a.patient_id) === patientId)
    .map((a) => ({ ...a, _pid: String(a.patient_id), _day: dayKey(a.created_at), _game: gameByName.get(String(a.exercise_name).toLowerCase()) }))

  return {
    db, role, therapistName, canSeeRevenue: role !== 'Therapist', today, from, to, prev, len, view, patientId, type, q,
    allAppts, scopeAppts, scopePatientIds, patientById, nameOf, patients, gsessions, allAssign, badges: badges.filter((b) => !patientId || String(b.patient_id) === patientId),
    gameById, skillOf, paoLevel: new Map(paoProfiles.map((p) => [String(p.patient_id), p.level])),
  }
}

const inRange = (day, r) => day >= r.from && day <= r.to
const apptsIn = (env, r) => env.scopeAppts.filter((a) => inRange(a._day, r))
const count = (list, st) => list.filter((a) => a.status === st).length
const finalised = (env, a) => a._day < env.today
const missedStatus = (env, a) => a.status === 'No Show' || a.status === 'Cancelled' || (finalised(env, a) && (a.status === 'Confirmed' || a.status === 'Pending'))

// ---------- shared table helper ----------
function table(rows, q, searchKeys, defaultSort) {
  const needle = String(q.q || '').toLowerCase().replace(/\s+/g, ' ').trim()
  let list = needle ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(needle))) : rows.slice()
  const [col, dir] = String(q.sort || defaultSort || '').split(':')
  if (col) {
    const sign = dir === 'desc' ? -1 : 1
    list.sort((a, b) => {
      const x = a[col]; const y = b[col]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign
    })
  }
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 20))
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  return { rows: list.slice((page - 1) * limit, page * limit), total: list.length, page, limit, all: list }
}

function perBucket(env, kind, items, dayOf, make) {
  return bucketList(env.from, env.to, kind).map((k) => {
    const [bs, be] = bucketRange(k, kind)
    const inside = items.filter((x) => dayOf(x) >= bs && dayOf(x) <= be)
    return { key: k, label: bucketLabel(k, kind), inProgress: be >= env.today && bs <= env.today, ...make(inside, k) }
  })
}

// ---------- APPOINTMENTS ----------
function appointmentsReport(env) {
  const cur = apptsIn(env, env), prv = apptsIn(env, env.prev)
  const up = (l) => count(l, 'Confirmed') + count(l, 'Pending')
  const kpis = [
    kpi('total', 'Total Appointments', cur.length, prv.length, { icon: 'calendar', tone: 'green' }),
    kpi('completed', 'Completed', count(cur, 'Completed'), count(prv, 'Completed'), { icon: 'check', tone: 'blue' }),
    kpi('upcoming', 'Upcoming', up(cur), up(prv), { icon: 'clock', tone: 'teal' }),
    kpi('cancelled', 'Cancelled', count(cur, 'Cancelled'), count(prv, 'Cancelled'), { good: 'down', icon: 'x', tone: 'red' }),
    kpi('noshow', 'No-show', count(cur, 'No Show'), count(prv, 'No Show'), { good: 'down', icon: 'ban', tone: 'orange' }),
  ]
  const kind = kindFor(env.view, false)
  const data = perBucket(env, kind, cur, (a) => a._day, (l) => ({ scheduled: l.length, completed: count(l, 'Completed') }))
  const statuses = ['Completed', 'Confirmed', 'Pending', 'Cancelled', 'No Show']
  const tally = (key, items) => { const m = new Map(); items.forEach((x) => { const v = key(x); if (v) m.set(v, (m.get(v) || 0) + 1) }); return [...m.entries()].sort((a, b) => b[1] - a[1]) }
  const wd = tally((a) => WEEKDAYS[(new Date(keyToDate(a._day).getTime() + MANILA).getUTCDay() + 6) % 7], cur)[0]
  const slot = tally((a) => a.time_slot_label || a.start_time, cur)[0]
  const online = cur.filter((a) => a.session_mode === 'Online').length
  return {
    kpis,
    charts: {
      primary: { title: `Appointments per ${kind === 'day' ? 'day' : kind}`, kind: 'group', series: [{ key: 'scheduled', label: 'Scheduled', color: '#94a3b8' }, { key: 'completed', label: 'Completed', color: STATUS_COLORS.Completed }], data },
      secondary: { title: 'Appointments by status', kind: 'bars', colorByPoint: true, data: statuses.map((s) => ({ label: s, value: count(cur, s), color: STATUS_COLORS[s] })), series: [{ key: 'value', label: 'Appointments' }] },
    },
    info: {
      busiestDay: wd ? { label: wd[0], count: wd[1] } : null, busiestSlot: slot ? { label: slot[0], count: slot[1] } : null,
      inPerson: cur.length - online, online, reasons: tally((a) => (a.status === 'Cancelled' ? a.cancelled_reason : null), cur).slice(0, 3).map(([label, n]) => ({ label, count: n })),
    },
    cols: [['date', 'Date'], ['time', 'Time'], ['patient', 'Patient'], ['therapyType', 'Therapy type'], ['mode', 'Mode'], ['status', 'Status'], ['duration', 'Duration'], ['payment', 'Payment']],
    _rows: async () => {
      const paid = new Set((await env.db.collection('payments').find({ appointment_id: { $in: cur.map((a) => a.appointment_id || new ObjectId(a._id)) }, status: 'Paid' }).project({ appointment_id: 1 }).toArray()).map((p) => String(p.appointment_id)))
      return cur.map((a) => ({ id: a._id, date: a._day, time: a.start_time, patientId: a._pid, patient: env.nameOf(a._pid), therapyType: a._type, mode: a.session_mode === 'Online' ? 'Online' : 'In-person', status: a.status, duration: `${minutes(a)} min`, payment: paid.has(a._id) ? 'Paid' : 'Unpaid' }))
    },
    search: ['patient', 'therapyType', 'status', 'mode', 'date'], defaultSort: 'date:desc',
  }
}

// ---------- SESSIONS ----------
async function sessionsReport(env) {
  const cur = apptsIn(env, env), prv = apptsIn(env, env.prev)
  const rate = (l) => pct(count(l, 'Completed'), count(l, 'Completed') + count(l, 'Cancelled') + count(l, 'No Show'))
  const hours = (l) => round1(l.filter((a) => a.status === 'Completed').reduce((s, a) => s + minutes(a), 0) / 60)
  const kpis = [
    kpi('total', 'Total Sessions', cur.length, prv.length, { icon: 'calendar', tone: 'green' }),
    kpi('completed', 'Completed', count(cur, 'Completed'), count(prv, 'Completed'), { icon: 'check', tone: 'blue' }),
    kpi('cancelled', 'Cancelled', count(cur, 'Cancelled'), count(prv, 'Cancelled'), { good: 'down', icon: 'x', tone: 'red' }),
    kpi('rate', 'Completion Rate', rate(cur) ?? 0, rate(prv) ?? 0, { suffix: '%', icon: 'target', tone: 'teal' }),
    kpi('hours', 'Therapy Hours', hours(cur), hours(prv), { icon: 'clock', tone: 'orange', decimals: true }),
  ]
  const kind = kindFor(env.view === 'daily' ? 'monthly' : env.view, false)
  const paid = env.canSeeRevenue ? await env.db.collection('payments').find({ appointment_id: { $in: cur.map((a) => new ObjectId(a._id)) }, status: 'Paid' }).toArray() : []
  const paidBy = new Map(paid.map((p) => [String(p.appointment_id), Number(p.amount) || 0]))
  const data = perBucket(env, kind, cur, (a) => a._day, (l) => {
    const comp = l.filter((a) => a.status === 'Completed')
    return {
      total: l.length, completed: comp.length, cancelled: count(l, 'Cancelled'), rate: pct(comp.length, comp.length + count(l, 'Cancelled') + count(l, 'No Show')),
      avgDuration: comp.length ? Math.round(comp.reduce((s, a) => s + minutes(a), 0) / comp.length) : null,
      revenue: l.reduce((s, a) => s + (paidBy.get(a._id) || 0), 0), Cognitive: l.filter((a) => a._type === 'Cognitive').length, Speech: l.filter((a) => a._type === 'Speech').length,
      Occupational: l.filter((a) => a._type === 'Occupational').length, Other: l.filter((a) => a._type === 'Other').length,
    }
  })
  let summary = ''
  const last = data[data.length - 1], before = data[data.length - 2]
  if (last && before) {
    const diff = last.completed - before.completed
    summary = `${Math.abs(diff)} ${diff >= 0 ? 'more' : 'fewer'} completed sessions than ${before.label}${before.completed ? ` (${diff >= 0 ? '+' : '-'}${Math.abs(Math.round((diff / before.completed) * 100))}%)` : ''}${last.inProgress ? ' so far (this period is in progress)' : ''}`
  } else if (last) summary = `${count(cur, 'Completed')} completed sessions in this period`
  const cols = [['label', 'Period'], ['total', 'Total'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['rate', 'Completion %'], ['avgDuration', 'Avg duration']]
  if (env.canSeeRevenue) cols.push(['revenue', 'Revenue'])
  return {
    kpis, summary,
    charts: {
      primary: { title: `Sessions per ${kind === 'day' ? 'day' : kind}`, kind: 'group', series: [{ key: 'completed', label: 'Completed', color: STATUS_COLORS.Completed }, { key: 'cancelled', label: 'Cancelled', color: STATUS_COLORS.Cancelled }], data },
      secondary: { title: 'Sessions by therapy type', kind: 'stack', series: ['Cognitive', 'Speech', 'Occupational', 'Other'].map((k) => ({ key: k, label: k, color: TYPE_COLORS[k] })), data },
    },
    cols, _rows: async () => data.map((d) => ({ id: d.key, ...d, label: d.label })), search: ['label'], defaultSort: '', noPatientLink: true,
  }
}

// ---------- progress helpers ----------
function exercisePctFor(env, pid, to) {
  const as = env.allAssign.filter((a) => a._pid === pid && a._day <= to)
  if (!as.length) return null
  const done = as.filter((a) => a.status === 'Completed' || env.gsessions.some((s) => s._pid === pid && String(s.game_id) === String(a._game?._id) && s._day >= a._day))
  return Math.round((done.length / as.length) * 100)
}
function progressOf(env, pid, r) {
  const ap = env.allAppts.filter((a) => a._pid === pid && inRange(a._day, r))
  const att = pct(count(ap, 'Completed'), count(ap, 'Completed') + count(ap, 'Cancelled') + count(ap, 'No Show'))
  const gs = env.gsessions.filter((s) => s._pid === pid && inRange(s._day, r))
  const att2 = gs.reduce((s, x) => s + Number(x.result?.attempts || 0), 0)
  const game = att2 ? Math.min(100, Math.round((gs.reduce((s, x) => s + Number(x.result?.correct || 0), 0) / att2) * 100)) : null
  const ex = exercisePctFor(env, pid, r.to)
  const m = mean([att, ex, game])
  return { progress: m == null ? null : Math.round(m), att, ex, game, sessions: count(ap, 'Completed') }
}
function patientFacts(env, pid) {
  const mine = env.allAppts.filter((a) => a._pid === pid).sort((a, b) => (a._day < b._day ? 1 : -1))
  const past = mine.filter((a) => a._day < env.today && ['Completed', 'Cancelled', 'No Show'].includes(a.status))
  let missed = 0
  for (const a of past) { if (a.status === 'Completed') break; missed += 1 }
  const lastDone = mine.find((a) => a.status === 'Completed')
  const next = mine.filter((a) => a._day >= env.today && ['Confirmed', 'Pending'].includes(a.status)).sort((a, b) => (a._day > b._day ? 1 : -1))[0]
  return { missedInARow: missed, lastDay: lastDone?._day || null, daysSince: lastDone ? diffDays(lastDone._day, env.today) : null, nextDay: next?._day || null, condition: mine.find((a) => a.condition)?.condition || '' }
}
function evalPatient(env, pid, range, prevRange) {
  const cur = progressOf(env, pid, range)
  const prv = prevRange ? progressOf(env, pid, prevRange) : { progress: null }
  const change = cur.progress != null && prv.progress != null ? cur.progress - prv.progress : null
  const f = patientFacts(env, pid)
  const st = patientStatus({ progress: cur.progress, change, missedInARow: f.missedInARow, daysSinceLastSession: f.daysSince, hasNextSession: Boolean(f.nextDay), exercisePct: cur.ex })
  return { ...cur, change, ...f, ...st }
}

// ---------- PROGRESS ----------
function progressReport(env) {
  const pids = [...new Set(apptsIn(env, env).map((a) => a._pid))]
  const rows = pids.map((pid) => { const e = evalPatient(env, pid, env, env.prev); return { id: pid, patientId: pid, patient: env.nameOf(pid), condition: e.condition || '—', sessions: e.sessions, progress: e.progress, change: e.change, lastSession: e.lastDay, nextSession: e.nextDay, status: e.status, why: e.why } })
  const prevIds = [...new Set(apptsIn(env, env.prev).map((a) => a._pid))]
  const prevStatuses = prevIds.map((pid) => patientStatus({ progress: progressOf(env, pid, env.prev).progress, hasNextSession: true, daysSinceLastSession: null, exercisePct: null }).status)
  const n = (list, s) => list.filter((x) => (x.status || x) === s).length
  const kpis = [
    kpi('patients', 'Patients', rows.length, prevIds.length, { icon: 'users', tone: 'green' }),
    kpi('ok', 'On Track', n(rows, 'On Track'), n(prevStatuses, 'On Track'), { icon: 'check', tone: 'blue' }),
    kpi('attention', 'Needs Attention', n(rows, 'Needs Attention'), n(prevStatuses, 'Needs Attention'), { good: 'down', icon: 'alert', tone: 'orange' }),
    kpi('critical', 'Critical', n(rows, 'Critical'), n(prevStatuses, 'Critical'), { good: 'down', icon: 'x', tone: 'red' }),
  ]
  const kind = kindFor(env.view, true)
  const line = perBucket(env, kind, [1], () => '', () => ({}))
  line.forEach((b) => {
    const [bs, be] = bucketRange(b.key, kind)
    const vals = pids.map((pid) => progressOf(env, pid, { from: bs < env.from ? env.from : bs, to: be > env.to ? env.to : be }).progress).filter((v) => v != null)
    b.value = vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null
  })
  return {
    kpis,
    charts: {
      primary: { title: 'Progress by patient (%)', kind: 'bars', max: 100, series: [{ key: 'value', label: 'Progress %', color: '#0d9488' }], data: rows.filter((r) => r.progress != null).sort((a, b) => a.progress - b.progress).map((r) => ({ label: r.patient, value: r.progress, patientId: r.patientId })) },
      secondary: { title: 'Average progress over time', kind: 'line', max: 100, series: [{ key: 'value', label: 'Average progress %', color: '#6366f1' }], data: line },
    },
    notice: 'Progress % is the average of three measures when available: session attendance, home-exercise completion and game accuracy.',
    cols: [['patient', 'Patient'], ['condition', 'Condition'], ['sessions', 'Sessions'], ['progress', 'Progress %'], ['change', 'Change'], ['lastSession', 'Last session'], ['nextSession', 'Next session'], ['status', 'Status']],
    _rows: async () => rows, search: ['patient', 'condition', 'status'], defaultSort: 'progress:asc',
  }
}

// ---------- EXERCISES ----------
function exerciseStats(env, r) {
  const gs = env.gsessions.filter((s) => inRange(s._day, r))
  const withAcc = gs.filter((s) => s._acc != null)
  const as = env.allAssign.filter((a) => a._day <= r.to)
  const doneCount = as.filter((a) => a.status === 'Completed' || env.gsessions.some((s) => s._pid === a._pid && String(s.game_id) === String(a._game?._id) && s._day >= a._day)).length
  const byPatient = new Map()
  withAcc.forEach((s) => { const v = byPatient.get(s._pid) || []; v.push(s._acc); byPatient.set(s._pid, v) })
  const patientAcc = [...byPatient.entries()].map(([pid, v]) => ({ pid, acc: Math.round(mean(v)) }))
  return { gs, avg: withAcc.length ? Math.round(mean(withAcc.map((s) => s._acc))) : null, done: gs.length, rate: pct(doneCount, as.length), patientAcc, patients: new Set([...gs.map((s) => s._pid), ...as.map((a) => a._pid)]).size }
}
function exercisesReport(env) {
  const c = exerciseStats(env, env), p = exerciseStats(env, env.prev)
  const kpis = [
    kpi('patients', 'Patients', c.patients, p.patients, { icon: 'users', tone: 'green' }),
    kpi('acc', 'Avg Accuracy', c.avg ?? 0, p.avg ?? 0, { suffix: '%', icon: 'target', tone: 'blue' }),
    kpi('done', 'Exercises Done', c.done, p.done, { icon: 'check', tone: 'teal' }),
    kpi('rate', 'Completion Rate', c.rate ?? 0, p.rate ?? 0, { suffix: '%', icon: 'chart', tone: 'orange' }),
    kpi('crit', 'Critical', c.patientAcc.filter((x) => x.acc < 35).length, p.patientAcc.filter((x) => x.acc < 35).length, { good: 'down', icon: 'x', tone: 'red' }),
  ]
  const line = perBucket(env, kindFor(env.view, true), c.gs.filter((s) => s._acc != null), (s) => s._day, (l) => ({ value: l.length ? Math.round(mean(l.map((s) => s._acc))) : null }))
  const byGame = new Map()
  c.gs.filter((s) => s._acc != null).forEach((s) => { const n = s._game?.name || 'Game'; const v = byGame.get(n) || []; v.push(s._acc); byGame.set(n, v) })
  const hardest = [...byGame.entries()].map(([name, v]) => ({ name, accuracy: Math.round(mean(v)), plays: v.length })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5)
  const keys = new Map()
  const add = (pid, name, gid) => { const k = `${pid}|${name}`; if (!keys.has(k)) keys.set(k, { pid, name, gid }) }
  env.allAssign.forEach((a) => add(a._pid, a._game?.name || a.exercise_name, a._game ? String(a._game._id) : null))
  c.gs.forEach((s) => add(s._pid, s._game?.name || 'Game', String(s.game_id)))
  const rows = [...keys.values()].map(({ pid, name, gid }) => {
    const mineS = c.gs.filter((s) => s._pid === pid && (s._game?.name || 'Game') === name)
    const accs = mineS.filter((s) => s._acc != null).map((s) => s._acc)
    const accuracy = accs.length ? Math.round(mean(accs)) : null
    const clinic = mineS.some((s) => s.employee_id)
    return {
      id: `${pid}-${name}`, patientId: pid, patient: env.nameOf(pid), exercise: name, assigned: env.allAssign.filter((a) => a._pid === pid && (a._game?.name || a.exercise_name) === name).length,
      completed: mineS.length, accuracy, lastDone: mineS.map((s) => s._day).sort().pop() || null, where: mineS.length ? (clinic ? 'Clinic' : 'Home') : '—',
      status: accuracy == null ? 'Not started' : accuracy < 35 ? 'Critical' : accuracy < 60 ? 'Needs Attention' : 'On Track',
    }
  })
  return {
    kpis,
    charts: {
      primary: { title: 'Accuracy by patient (%)', kind: 'bars', max: 100, series: [{ key: 'value', label: 'Accuracy %', color: '#0d9488' }], data: c.patientAcc.map((x) => ({ label: env.nameOf(x.pid), value: x.acc, patientId: x.pid })).sort((a, b) => a.value - b.value) },
      secondary: { title: 'Accuracy over time', kind: 'line', max: 100, series: [{ key: 'value', label: 'Accuracy %', color: '#6366f1' }], data: line },
    },
    hardest,
    cols: [['patient', 'Patient'], ['exercise', 'Exercise'], ['assigned', 'Assigned'], ['completed', 'Completed'], ['accuracy', 'Accuracy'], ['lastDone', 'Last done'], ['where', 'Where'], ['status', 'Status']],
    _rows: async () => rows, search: ['patient', 'exercise', 'status'], defaultSort: 'accuracy:asc',
  }
}

// ---------- ATTENDANCE (from appointments; patient ID-card scans are not recorded) ----------
function attendanceReport(env) {
  const stats = (l) => {
    const done = l.filter((a) => a._day <= env.today)
    const att = count(done, 'Completed'), canc = count(done, 'Cancelled'), miss = done.filter((a) => a.status === 'No Show' || (a._day < env.today && ['Confirmed', 'Pending'].includes(a.status))).length
    return { att, canc, miss, rate: pct(att, att + miss) }
  }
  const c = stats(apptsIn(env, env)), p = stats(apptsIn(env, env.prev))
  const kpis = [
    kpi('rate', 'Attendance Rate', c.rate ?? 0, p.rate ?? 0, { suffix: '%', icon: 'id', tone: 'green' }),
    kpi('att', 'Attended', c.att, p.att, { icon: 'check', tone: 'blue' }),
    kpi('canc', 'Cancelled', c.canc, p.canc, { good: 'down', icon: 'x', tone: 'orange' }),
    kpi('miss', 'Absent', c.miss, p.miss, { good: 'down', icon: 'ban', tone: 'red' }),
  ]
  const cur = apptsIn(env, env).filter((a) => a._day <= env.today)
  const weekly = perBucket(env, kindFor(env.view === 'daily' ? 'daily' : env.view, true), cur, (a) => a._day, (l) => { const s = stats(l); return { Attended: s.att, Cancelled: s.canc, Absent: s.miss } })
  const wd = WEEKDAYS.map((name, i) => { const l = cur.filter((a) => (new Date(keyToDate(a._day).getTime() + MANILA).getUTCDay() + 6) % 7 === i); const s = stats(l); return { label: name.slice(0, 3), value: s.rate, total: l.length } })
  const pids = [...new Set(cur.map((a) => a._pid))]
  const rows = pids.map((pid) => {
    const l = cur.filter((a) => a._pid === pid); const s = stats(l); const f = patientFacts(env, pid)
    const lastAtt = l.filter((a) => a.status === 'Completed').map((a) => a._day).sort().pop() || null
    const seq = env.allAppts.filter((a) => a._pid === pid && a._day < env.today).sort((a, b) => (a._day < b._day ? 1 : -1))
    let run = 0; for (const a of seq) { if (a.status === 'Completed') break; if (a.status === 'Cancelled') continue; run += 1 }
    return { id: pid, patientId: pid, patient: env.nameOf(pid), scheduled: s.att + s.canc + s.miss, attended: s.att, cancelled: s.canc, absent: s.miss, lastAttended: lastAtt, flag: run >= 2 ? `Absent ${run} in a row` : '—' }
  })
  return {
    kpis, notice: 'Patient ID-card scans are not recorded yet, so this report uses appointment outcomes: Completed = attended; No-show, or a past booking that was never completed = absent. On time and late are not available.',
    charts: {
      primary: { title: 'Attendance per week', kind: 'stack', series: [{ key: 'Attended', label: 'Attended', color: STATUS_COLORS.Completed }, { key: 'Cancelled', label: 'Cancelled', color: '#f59e0b' }, { key: 'Absent', label: 'Absent', color: STATUS_COLORS.Cancelled }], data: weekly },
      secondary: { title: 'Attendance rate by weekday (%)', kind: 'bars', max: 100, series: [{ key: 'value', label: 'Attendance %', color: '#0d9488' }], data: wd },
    },
    cols: [['patient', 'Patient'], ['scheduled', 'Scheduled'], ['attended', 'Attended'], ['cancelled', 'Cancelled'], ['absent', 'Absent'], ['lastAttended', 'Last attended'], ['flag', 'Flag']],
    _rows: async () => rows, search: ['patient', 'flag'], defaultSort: 'absent:desc',
  }
}

// ---------- GAMES ----------
function gamesReport(env) {
  const stats = (r) => {
    const gs = env.gsessions.filter((s) => inRange(s._day, r)); const withAcc = gs.filter((s) => s._acc != null)
    return { gs, plays: gs.length, avg: withAcc.length ? Math.round(mean(withAcc.map((s) => s._acc))) : null, badges: env.badges.filter((b) => inRange(dayKey(b.earned_at), r)).length, players: new Set(gs.map((s) => s._pid)).size }
  }
  const c = stats(env), p = stats(env.prev)
  const kpis = [
    kpi('plays', 'Games Played', c.plays, p.plays, { icon: 'gamepad', tone: 'green' }),
    kpi('acc', 'Avg Accuracy', c.avg ?? 0, p.avg ?? 0, { suffix: '%', icon: 'target', tone: 'blue' }),
    kpi('badges', 'Badges Earned', c.badges, p.badges, { icon: 'award', tone: 'orange' }),
    kpi('players', 'Active Players', c.players, p.players, { icon: 'users', tone: 'teal' }),
  ]
  const byGame = new Map(); c.gs.forEach((s) => { const n = s._game?.name || 'Game'; byGame.set(n, (byGame.get(n) || 0) + 1) })
  const most = [...byGame.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))
  const kind = kindFor(env.view, true)
  const trend = perBucket(env, kind, c.gs.filter((s) => s._acc != null), (s) => s._day, (l) => {
    const sk = (name) => { const v = l.filter((s) => env.skillOf(s._game) === name).map((s) => s._acc); return v.length ? Math.round(mean(v)) : null }
    return { Cognitive: sk('Cognitive'), 'Speech & Language': sk('Speech & Language') }
  })
  const pids = [...new Set(c.gs.map((s) => s._pid))]
  const rows = pids.map((pid) => {
    const l = c.gs.filter((s) => s._pid === pid); const fav = new Map(); l.forEach((s) => { const n = s._game?.name || 'Game'; fav.set(n, (fav.get(n) || 0) + 1) })
    const accs = l.filter((s) => s._acc != null).map((s) => s._acc)
    return { id: pid, patientId: pid, patient: env.nameOf(pid), played: l.length, favorite: [...fav.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—', accuracy: accs.length ? Math.round(mean(accs)) : null, hints: l.reduce((s, x) => s + Number(x.result?.hints_used || 0), 0), badges: env.badges.filter((b) => String(b.patient_id) === pid).length, paoLevel: env.paoLevel.get(pid) ?? null }
  })
  return {
    kpis,
    charts: {
      primary: { title: 'Most played games', kind: 'hbar', series: [{ key: 'value', label: 'Times played', color: '#0d9488' }], data: most },
      secondary: { title: 'Average accuracy by skill', kind: 'line', max: 100, series: [{ key: 'Cognitive', label: 'Cognitive', color: '#6366f1' }, { key: 'Speech & Language', label: 'Speech & Language', color: '#0d9488' }], data: trend },
    },
    cols: [['patient', 'Patient'], ['played', 'Games played'], ['favorite', 'Favorite game'], ['accuracy', 'Avg accuracy'], ['hints', 'Hints used'], ['badges', 'Badges'], ['paoLevel', 'Pao level']],
    _rows: async () => rows, search: ['patient', 'favorite'], defaultSort: 'played:desc',
  }
}

// ---------- INDIVIDUAL PATIENT ----------
async function patientReport(env) {
  const pid = env.patientId
  if (!pid || !env.scopePatientIds.includes(pid)) throw Object.assign(new Error('That patient is not one of your patients.'), { status: 403 })
  const p = env.patientById.get(pid)
  const mine = env.allAppts.filter((a) => a._pid === pid)
  const inR = mine.filter((a) => inRange(a._day, env)), inP = mine.filter((a) => inRange(a._day, env.prev))
  const rate = (l) => pct(count(l, 'Completed'), count(l, 'Completed') + count(l, 'Cancelled') + count(l, 'No Show'))
  const e = evalPatient(env, pid, env, env.prev)
  const prevProg = progressOf(env, pid, env.prev).progress
  const kpis = [
    kpi('attended', 'Sessions Attended', count(inR, 'Completed'), count(inP, 'Completed'), { icon: 'check', tone: 'green' }),
    kpi('rate', 'Attendance', rate(inR) ?? 0, rate(inP) ?? 0, { suffix: '%', icon: 'id', tone: 'blue' }),
    kpi('progress', 'Progress', e.progress ?? 0, prevProg ?? 0, { suffix: '%', icon: 'chart', tone: 'teal' }),
    kpi('ex', 'Home Exercises Done', e.ex ?? 0, null, { suffix: '%', icon: 'target', tone: 'orange' }),
  ]
  const kind = kindFor(env.view, true)
  const progLine = perBucket(env, kind, [1], () => '', () => ({}))
  progLine.forEach((b) => { const [bs, be] = bucketRange(b.key, kind); b.value = progressOf(env, pid, { from: bs < env.from ? env.from : bs, to: be > env.to ? env.to : be }).progress })
  const accLine = perBucket(env, kind, env.gsessions.filter((s) => s._acc != null && s._pid === pid), (s) => s._day, (l) => ({ value: l.length ? Math.round(mean(l.map((s) => s._acc))) : null }))

  const note = await env.db.collection('therapy_notes').find({ patient_id: new ObjectId(pid), status: 'signed', is_archived: { $ne: true } }).sort({ session_date: -1, created_at: -1 }).limit(1).next()
  let soap = null
  if (note) { try { const d = decryptSoap(note); soap = { date: dayKey(note.session_date), assessment: d.assessment, plan: d.plan, signedBy: note.employee_name || '' } } catch { soap = { date: dayKey(note.session_date), assessment: '', plan: '', signedBy: note.employee_name || '' } } }
  const exercises = env.allAssign.filter((a) => a._pid === pid).map((a) => ({ name: a._game?.name || a.exercise_name, due: a.due_date || null, status: a.status === 'Completed' || env.gsessions.some((s) => s._pid === pid && String(s.game_id) === String(a._game?._id) && s._day >= a._day) ? 'Done' : 'Assigned' }))
  const gs = env.gsessions.filter((s) => s._pid === pid)
  const fav = new Map(); gs.forEach((s) => { const n = s._game?.name || 'Game'; fav.set(n, (fav.get(n) || 0) + 1) })
  const badgeDocs = env.badges.filter((b) => String(b.patient_id) === pid)
  const names = badgeDocs.length ? (await env.db.collection('badges').find({ _id: { $in: badgeDocs.map((b) => b.badge_id) } }).project({ name: 1 }).toArray()).map((b) => b.name) : []
  const remarks = await env.db.collection('report_remarks').findOne({ patient_id: new ObjectId(pid) })
  const age = p?.birthdate ? Math.max(0, Math.floor((Date.now() - new Date(p.birthdate).getTime()) / (365.25 * DAY))) : null
  const first = p?.first_name || 'Your child'
  const summary = `${first} attended ${count(inR, 'Completed')} session${count(inR, 'Completed') === 1 ? '' : 's'} between ${env.from} and ${env.to}${rate(inR) != null ? ` (${rate(inR)}% attendance)` : ''}. ${e.progress != null ? `Overall progress is ${e.progress}%${e.change != null ? `, ${e.change >= 0 ? 'up' : 'down'} ${Math.abs(e.change)} points from the period before` : ''}. ` : ''}${e.why ? `Status: ${e.status} (${e.why}).` : ''}`
  return {
    patientId: pid,
    header: { name: env.nameOf(pid), age, condition: e.condition || '—', guardian: [p?.guardian_first_name, p?.guardian_last_name].filter(Boolean).join(' ') || '—', therapist: env.therapistName, from: env.from, to: env.to, status: e.status, why: e.why },
    kpis, summary,
    charts: {
      primary: { title: 'Progress over time', kind: 'line', max: 100, series: [{ key: 'value', label: 'Progress %', color: '#0d9488' }], data: progLine },
      secondary: { title: 'Exercise and game accuracy over time', kind: 'line', max: 100, series: [{ key: 'value', label: 'Accuracy %', color: '#6366f1' }], data: accLine },
    },
    sections: {
      soap, exercises, games: { played: gs.length, favorite: [...fav.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null, badges: names },
      remarks: { text: remarks?.text || '', updatedAt: remarks?.updated_at || null },
    },
    notice: 'Goals are not tracked as structured data yet, so "Goals met" is replaced by home-exercise completion.',
    table: { rows: [], total: 0, page: 1, limit: 20 }, cols: [],
  }
}

export const REPORTS = { appointments: appointmentsReport, sessions: sessionsReport, progress: progressReport, exercises: exercisesReport, attendance: attendanceReport, games: gamesReport }

export async function runReport(env, type) {
  if (type === 'patient') { const r = await patientReport(env); return { ...r, meta: { from: env.from, to: env.to, previous: env.prev, today: env.today } } }
  const make = REPORTS[type]
  if (!make) throw Object.assign(new Error('Unknown report.'), { status: 404 })
  const r = await make(env)
  const all = await r._rows()
  const t = table(all, env.q, r.search, r.defaultSort)
  const { _rows, search, defaultSort, ...rest } = r
  return { ...rest, table: { rows: t.rows, total: t.total, page: t.page, limit: t.limit }, meta: { from: env.from, to: env.to, previous: env.prev, today: env.today, view: env.view, canSeeRevenue: env.canSeeRevenue } }
}

// Every row (unpaged) for exports.
export async function allRows(env, type) {
  const r = await REPORTS[type](env)
  const rows = await r._rows()
  return { cols: r.cols, rows: table(rows, { ...env.q, limit: 200, page: 1 }, r.search, r.defaultSort).all, kpis: r.kpis }
}
