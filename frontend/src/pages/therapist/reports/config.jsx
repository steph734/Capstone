import { Activity, Award, BarChart3, Calendar, CalendarCheck, CheckCircle2, Clock, Dumbbell, FileText, Gamepad2, IdCard, Ban, Target, TrendingUp, Users, XCircle, AlertTriangle } from 'lucide-react'

export const REPORT_TYPES = [
  { id: 'appointments', label: 'Appointments Report', Icon: Calendar, tint: '#e6f5f2', color: '#159a72', desc: 'All scheduled and completed appointments', headline: 'Overview of all scheduled and completed appointments' },
  { id: 'progress', label: 'Patient Progress Report', Icon: TrendingUp, tint: '#eef2ff', color: '#6366f1', desc: 'Per-patient session progress and status', headline: 'How each patient is progressing and who needs attention' },
  { id: 'sessions', label: 'Session Summary Report', Icon: FileText, tint: '#eff6ff', color: '#3b82f6', desc: 'Monthly session counts and completion rates', headline: 'Sessions held, cancelled and completion rates' },
  { id: 'exercises', label: 'Exercise Performance Report', Icon: Dumbbell, tint: '#fff4ed', color: '#ea6a1e', desc: 'Performance analytics for assigned exercises', headline: 'Accuracy and completion of assigned exercises' },
  { id: 'attendance', label: 'Attendance Report', Icon: IdCard, tint: '#f5f0ff', color: '#8b5cf6', desc: 'ID scans, on time, late and absent', headline: 'Who attended, who cancelled and who was absent' },
  { id: 'games', label: 'Gamified Activities Report', Icon: Gamepad2, tint: '#ecfdf5', color: '#059669', desc: 'Games played, accuracy and badges', headline: 'Games played, accuracy and badges earned' },
]

export const KPI_ICONS = { calendar: Calendar, check: CheckCircle2, clock: Clock, x: XCircle, ban: Ban, target: Target, users: Users, alert: AlertTriangle, chart: BarChart3, id: IdCard, gamepad: Gamepad2, award: Award, activity: Activity, done: CalendarCheck }
export const KPI_TONE = { green: 'green', blue: 'blue', teal: 'teal', red: 'red', orange: 'amber' }
export const STATUS_CLASS = {
  Confirmed: 'rpt-status-confirmed', Completed: 'rpt-status-completed', Pending: 'rpt-status-pending', Cancelled: 'rpt-status-cancelled', 'No Show': 'rpt-status-noshow',
  'On Track': 'rpt-status-confirmed', 'Needs Attention': 'rpt-status-pending', Critical: 'rpt-status-cancelled', 'Not started': 'rpt-status-pending', Paid: 'rpt-status-confirmed', Unpaid: 'rpt-status-pending',
}

// Asia/Manila calendar helpers (YYYY-MM-DD strings)
export const todayKey = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
const shift = (k, n) => new Date(new Date(`${k}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
export function presetRange(id) {
  const t = todayKey()
  if (id === 'week') { const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7; return { from: shift(t, -dow), to: t } }
  if (id === 'month') return { from: `${t.slice(0, 7)}-01`, to: t }
  if (id === '3months') { const [y, m] = t.split('-').map(Number); const d = new Date(Date.UTC(y, m - 3, 1)); return { from: d.toISOString().slice(0, 10), to: t } }
  return { from: `${t.slice(0, 4)}-01-01`, to: t }
}
export const PRESETS = [['week', 'This week'], ['month', 'This month'], ['3months', 'Last 3 months'], ['year', 'This year']]
export const VIEWS = [['daily', 'Daily'], ['monthly', 'Monthly'], ['annual', 'Annual']]
export const THERAPY_TYPES = ['All', 'Cognitive', 'Speech', 'Occupational']

// Patient A, Patient B, ... for research / sharing exports.
export function anonymizer() {
  const map = new Map()
  const name = (n) => {
    if (!n) return n
    if (!map.has(n)) { const i = map.size; map.set(n, `Patient ${i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${String.fromCharCode(65 + (i % 26))}`}`) }
    return map.get(n)
  }
  return name
}
