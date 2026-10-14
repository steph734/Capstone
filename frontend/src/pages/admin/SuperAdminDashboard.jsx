import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Building2, Calendar, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CreditCard, FileText, Gamepad2, Inbox,
  List, Lock, Pencil, Plus, Server, ShieldAlert, TrendingUp, TriangleAlert,
} from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import AddBranchModal from './branches/AddBranchModal'
import { adminMenuItems } from './adminSidebarConfig'
import { authFetch } from '../../utils/session'
import './branches/Branches.css'
import './SuperAdminDashboard.css'

const PH_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000
const phDay = (ms) => new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 10)
const addDays = (ymd, n) => phDay(new Date(`${ymd}T00:00:00+08:00`).getTime() + n * DAY)

const PRESETS = [
  { key: '7', label: 'Last 7 days', range: (t) => ({ from: addDays(t, -6), to: t }) },
  { key: '30', label: 'Last 30 days', range: (t) => ({ from: addDays(t, -29), to: t }) },
  { key: '90', label: 'Last 90 days', range: (t) => ({ from: addDays(t, -89), to: t }) },
  { key: 'month', label: 'This month', range: (t) => ({ from: `${t.slice(0, 7)}-01`, to: t }) },
]

const fmtDay = (ymd) => new Date(`${ymd}T00:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
const peso = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: n >= 10000 ? 1 : 0 }).format(n || 0)
const pesoFull = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(n || 0)

function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function greeting() {
  const h = new Date(Date.now() + PH_OFFSET_MS).getUTCHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const ACTIVITY_ICON = { security: Lock, branch: Building2, note: FileText, billing: CreditCard, game: Gamepad2, other: Pencil }
const ACTIVITY_TONE = { security: 'red', branch: 'amber', note: 'purple', billing: 'blue', game: 'purple', other: 'green' }
const ATTENTION_ICON = { branches: Building2, requests: Inbox, locked: Lock, expiring: CreditCard, drafts: Gamepad2 }
const ATTENTION_TONE = { branches: 'amber', requests: 'purple', locked: 'red', expiring: 'blue', drafts: 'gray' }
const PLAN_COLORS = ['#1fa37a', '#f0b43c', '#7c5ce0', '#3b82c4']

function Skel({ w = '100%', h = 14, r = 8, style }) {
  return <span className="sd-skel" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />
}

function Change({ pct, suffix = 'vs last period' }) {
  if (pct == null) return <em className="sd-change flat">No prior data</em>
  const up = pct >= 0
  return <em className={`sd-change ${up ? 'up' : 'down'}`}>{up ? '+' : ''}{pct}% {suffix}</em>
}

function Panel({ title, sub, icon: Icon, link, children, className = '' }) {
  return (
    <section className={`sd-panel ${className}`}>
      <header className="sd-panel-head">
        <div>
          <h2>{Icon && <Icon size={17} aria-hidden="true" />} {title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {link && <Link to={link.to} className="sd-panel-link">{link.label} <ChevronRight size={15} aria-hidden="true" /></Link>}
      </header>
      {children}
    </section>
  )
}

const Empty = ({ icon: Icon = CircleCheck, children }) => (
  <div className="sd-empty"><Icon size={22} aria-hidden="true" /><p>{children}</p></div>
)

function DateRange({ from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState({ from, to })
  const wrap = useRef(null)
  const today = phDay(Date.now())
  const active = PRESETS.find((p) => { const r = p.range(today); return r.from === from && r.to === to })
  const label = active ? active.label : `${fmtDay(from)} – ${fmtDay(to)}`

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const customError = custom.from > custom.to ? 'Start date must be on or before the end date.'
    : (new Date(custom.to) - new Date(custom.from)) / DAY > 365 ? 'Choose a range of one year or less.' : ''

  return (
    <div className="sd-range" ref={wrap}>
      <button type="button" className="br-btn btn-line" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setCustom({ from, to }); setOpen(!open) }}>
        <Calendar size={16} aria-hidden="true" /> {label} <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="sd-range-pop" role="dialog" aria-label="Choose date range">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={active?.key === p.key ? 'on' : ''} onClick={() => { onChange(p.range(today)); setOpen(false) }}>{p.label}</button>
          ))}
          <div className="sd-range-custom">
            <label>From<input type="date" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></label>
            <label>To<input type="date" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></label>
            {customError && <p className="br-error">{customError}</p>}
            <button type="button" className="br-btn primary" disabled={Boolean(customError) || !custom.from || !custom.to}
              onClick={() => { onChange({ from: custom.from, to: custom.to }); setOpen(false) }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const subs = payload.find((p) => p.dataKey === 'subscribers')
  const rev = payload.find((p) => p.dataKey === 'revenue')
  return (
    <div className="sd-tip">
      <strong>{label}</strong>
      {subs && subs.value != null && <p><i style={{ background: '#2c4a3e' }} /> Active subscribers: <b>{subs.value}</b></p>}
      {rev && <p><i style={{ background: '#b9d9cb' }} /> Revenue: <b>{pesoFull(rev.value)}</b></p>}
    </div>
  )
}

function TrendChart({ series, subscribersAvailable }) {
  const [mode, setMode] = useState('monthly')
  const data = series[mode]
  const hasData = data.some((d) => d.revenue > 0 || (d.subscribers ?? 0) > 0)
  return (
    <Panel title="Subscribers & revenue" icon={TrendingUp} sub={mode === 'monthly' ? 'Monthly, up to the end of the selected range' : 'Weekly, up to the end of the selected range'} className="sd-chart-panel">
      <div className="sd-toggle" role="group" aria-label="Chart interval">
        <button type="button" className={mode === 'weekly' ? 'on' : ''} aria-pressed={mode === 'weekly'} onClick={() => setMode('weekly')}>Weekly</button>
        <button type="button" className={mode === 'monthly' ? 'on' : ''} aria-pressed={mode === 'monthly'} onClick={() => setMode('monthly')}>Monthly</button>
      </div>
      {!subscribersAvailable && <p className="sd-note"><TriangleAlert size={14} aria-hidden="true" /> Subscriber counts come from Stripe and are unavailable right now. Revenue is still shown.</p>}
      {hasData ? (
        <div className="sd-chart" role="img" aria-label={`Chart of ${mode} active subscribers and revenue. A table with the same data follows.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#e6eee9" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7c75', fontWeight: 700 }} />
              <YAxis yAxisId="rev" orientation="left" tickLine={false} axisLine={false} width={46} tick={{ fontSize: 11, fill: '#6b7c75' }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : v)} />
              <YAxis yAxisId="subs" orientation="right" tickLine={false} axisLine={false} width={34} allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7c75' }} hide={!subscribersAvailable} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(31,163,122,.08)' }} />
              <Bar yAxisId="rev" dataKey="revenue" fill="#cfe6dc" radius={[6, 6, 0, 0]} maxBarSize={44} name="Revenue" />
              {subscribersAvailable && <Line yAxisId="subs" type="monotone" dataKey="subscribers" stroke="#2c4a3e" strokeWidth={2.5} dot={{ r: 4, fill: '#2c4a3e' }} name="Active subscribers" />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : <Empty icon={TrendingUp}>No subscribers or revenue recorded for this period yet.</Empty>}
      <div className="sd-legend">
        {subscribersAvailable && <span><i className="line" /> Active subscribers</span>}
        <span><i className="bar" /> Revenue (₱)</span>
      </div>
      <details className="sd-table-fallback">
        <summary>View as table</summary>
        <table>
          <thead><tr><th scope="col">Period</th><th scope="col">Active subscribers</th><th scope="col">Revenue</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th><td>{d.subscribers ?? 'Unavailable'}</td><td>{pesoFull(d.revenue)}</td></tr>)}</tbody>
        </table>
      </details>
    </Panel>
  )
}

function StatCard({ tile, icon: Icon, value, label, children, tone = '', action }) {
  return (
    <div className={`sd-stat ${tone}`}>
      <span className={`br-tile ${tile}`}><Icon size={22} aria-hidden="true" /></span>
      <div><strong>{value}</strong><span>{label}</span>{children}</div>
      {action}
    </div>
  )
}

const HEALTH_TEXT = { online: 'Online', degraded: 'Degraded', offline: 'Offline' }

export default function SuperAdminDashboard({ user, onLogout }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = phDay(Date.now())
  const def = PRESETS[1].range(today)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') ? params.get('from') : def.from
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') ? params.get('to') : def.to

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [branchModal, setBranchModal] = useState(null) // { owners, branches }
  const [toast, setToast] = useState('')
  const reqId = useRef(0)
  const toastTimer = useRef(null)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    setError('')
    try {
      const res = await authFetch('/api/admin/dashboard', { query: { from, to } })
      if (id === reqId.current) setData(res)
    } catch (err) {
      if (id === reqId.current) setError(err.message)
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [from, to])
  useEffect(() => { load() }, [load])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const setRange = (r) => setParams({ from: r.from, to: r.to }, { replace: true })

  const openAddBranch = async () => {
    try {
      const [list, owners] = await Promise.all([
        authFetch('/api/admin/branches'),
        authFetch('/api/admin/branch-owners').catch(() => ({ owners: [] })),
      ])
      setBranchModal({ branches: list.branches, owners: owners.owners })
    } catch (err) {
      setError(err.message)
    }
  }

  const donut = useMemo(() => data?.plans.items.map((p, i) => ({ ...p, fill: PLAN_COLORS[i % PLAN_COLORS.length] })) || [], [data])
  const first = !data
  const s = data?.stats

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="Dashboard" subtitle={`${greeting()}. Here's how TherapyPro is doing across all branches.`} icon="" menuItems={adminMenuItems}>
      <div className="sd-page br-page">
        <div className="sd-toolbar">
          <DateRange from={from} to={to} onChange={setRange} />
          <Link to="/admin/audit-logs" className="br-btn btn-line"><List size={16} aria-hidden="true" /> Review logs</Link>
          <Link to="/admin/games-library/builder/new" className="br-btn btn-line"><Gamepad2 size={16} aria-hidden="true" /> Create game</Link>
          <button type="button" className="br-btn primary" onClick={openAddBranch}><Plus size={17} aria-hidden="true" /> Add branch</button>
        </div>

        {error && (
          <div className="br-callout red" role="alert">
            <CircleAlert size={16} aria-hidden="true" /><span>{error}</span>
            <button type="button" className="br-btn btn-line sd-retry" onClick={load}>Try again</button>
          </div>
        )}

        <div className={`sd-body${loading && data ? ' refreshing' : ''}`} aria-busy={loading}>
          <section className="sd-stats" aria-label="Summary">
            {first ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="sd-stat"><Skel w={48} h={48} r={14} /><div style={{ flex: 1 }}><Skel w="40%" h={26} /><Skel w="70%" style={{ marginTop: 8 }} /></div></div>
            )) : (
              <>
                <StatCard tile="blue" icon={Building2} value={s.branches.total} label="Branches">
                  <em className="sd-change up">{s.branches.active} active · {s.branches.review} under review</em>
                </StatCard>
                <StatCard tile="green" icon={CreditCard} value={s.subscribers.value ?? '—'} label="Active subscribers">
                  {s.subscribers.value == null ? <em className="sd-change flat">Unavailable</em> : <Change pct={s.subscribers.changePct} />}
                </StatCard>
                <StatCard tile="yellow" icon={TrendingUp} value={peso(s.revenue.value)} label="Revenue">
                  <Change pct={s.revenue.changePct} />
                </StatCard>
                <StatCard tile="purple" icon={Gamepad2} value={s.games.total} label="Games in library">
                  <em className="sd-change up">{s.games.updated} updated in range</em>
                </StatCard>
                <StatCard tile="red" icon={ShieldAlert} value={s.security.alerts} label="Security alerts today" tone={s.security.alerts ? 'danger' : ''}
                  action={s.security.alerts > 0 && <Link className="sd-stat-link" to="/admin/audit-logs?filter=security">Review</Link>}>
                  <em className={`sd-change ${s.security.alerts ? 'down' : 'up'}`}>
                    {s.security.alerts ? `${s.security.locked} locked · ${s.security.repeatedFailed} repeated failed` : 'All clear'}
                  </em>
                </StatCard>
              </>
            )}
          </section>

          <div className="sd-row sd-row-main">
            {first ? <Panel title="Subscribers & revenue" icon={TrendingUp}><Skel h={250} r={12} /></Panel> : <TrendChart series={data.series} subscribersAvailable={data.subscribersAvailable} />}

            <Panel title="Needs your attention" icon={TriangleAlert} sub="Items waiting on the Super Admin">
              {first ? <div className="sd-skel-list">{[0, 1, 2, 3].map((i) => <Skel key={i} h={46} r={12} />)}</div>
                : data.attention.length === 0 ? <Empty>Nothing needs your attention right now.</Empty>
                : (
                  <ul className="sd-attn">
                    {data.attention.map((a) => {
                      const Icon = ATTENTION_ICON[a.key] || CircleAlert
                      return (
                        <li key={a.key}>
                          <span className={`sd-ico ${ATTENTION_TONE[a.key]}`}><Icon size={18} aria-hidden="true" /></span>
                          <div><strong>{a.title}</strong>{a.detail && <small>{a.detail}</small>}</div>
                          <button type="button" className="br-btn btn-line sm" onClick={() => navigate(a.to)}>{a.action}</button>
                        </li>
                      )
                    })}
                  </ul>
                )}
            </Panel>
          </div>

          <div className="sd-row sd-row-three">
            <Panel title="Branch performance" icon={Building2} sub="Sessions within the selected range" link={{ to: '/admin/branches', label: 'All branches' }}>
              {first ? <Skel h={150} r={12} /> : data.branches.length === 0 ? <Empty icon={Building2}>No active branches yet.</Empty> : (
                <div className="sd-table-wrap">
                  <table className="sd-table">
                    <thead><tr><th scope="col">Branch</th><th scope="col">Therapists</th><th scope="col">Sessions</th><th scope="col">Capacity</th><th scope="col">Status</th></tr></thead>
                    <tbody>
                      {data.branches.map((b) => (
                        <tr key={b.id}>
                          <th scope="row">{b.name}</th>
                          <td>{b.therapists}</td>
                          <td>{b.sessions || '—'}</td>
                          <td>
                            {b.capacityPct == null ? <span className="sd-muted">Not set</span> : (
                              <div className="sd-cap"><div className={`sd-bar${b.capacityPct >= 100 ? ' full' : ''}`}><div style={{ width: `${b.capacityPct}%` }} /></div><span>{b.capacityPct}%</span></div>
                            )}
                          </td>
                          <td><span className={`br-pill ${b.status === 'Active' ? 'green' : 'amber'} flat`}>{b.status === 'Under review' ? 'Review' : b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Plans" icon={CreditCard} sub={first ? ' ' : `${data.plans.total} active subscriber${data.plans.total === 1 ? '' : 's'}`}>
              {first ? <Skel h={150} r={12} /> : !data.planDataAvailable ? <Empty icon={TriangleAlert}>Paid plan counts come from Stripe and are unavailable right now.</Empty>
                : data.plans.total === 0 ? <Empty icon={CreditCard}>No paid subscribers yet.</Empty> : (
                  <div className="sd-plans">
                    <div className="sd-donut" role="img" aria-label={`Plans: ${donut.map((p) => `${p.label} ${p.count}`).join(', ')}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donut} dataKey="count" nameKey="label" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="none">
                            {donut.map((p) => <Cell key={p.key} fill={p.fill} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="sd-donut-mid"><strong>{data.plans.total}</strong><span>subscribers</span></div>
                    </div>
                    <ul className="sd-plan-list">
                      {donut.map((p) => <li key={p.key}><i style={{ background: p.fill }} /> <b>{p.label}</b> {p.count} · {p.pct}%</li>)}
                    </ul>
                  </div>
                )}
            </Panel>

            <Panel title="System health" icon={Server} sub={first ? ' ' : `Checked ${ago(data.health.checkedAt)}`}>
              {first ? <div className="sd-skel-list">{[0, 1, 2, 3, 4].map((i) => <Skel key={i} h={22} />)}</div> : (
                <ul className="sd-health">
                  {data.health.services.map((h) => (
                    <li key={h.key} title={h.detail || undefined}>
                      <span>{h.label}</span>
                      <b className={`sd-status ${h.status}`}>
                        {h.status === 'online' ? <CircleCheck size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />} {HEALTH_TEXT[h.status]}
                      </b>
                    </li>
                  ))}
                  <li><span>Last backup</span><b className="sd-plain">{data.health.lastBackup ? new Date(data.health.lastBackup).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not reported'}</b></li>
                </ul>
              )}
            </Panel>
          </div>

          <div className="sd-row sd-row-two">
            <Panel title="Recent activity" icon={List} sub="Latest actions in the selected range" link={{ to: '/admin/audit-logs', label: 'Audit logs' }}>
              {first ? <div className="sd-skel-list">{[0, 1, 2, 3].map((i) => <Skel key={i} h={42} r={10} />)}</div>
                : data.recent.length === 0 ? <Empty icon={List}>No activity recorded in this range.</Empty> : (
                  <ul className="sd-activity">
                    {data.recent.map((r) => {
                      const Icon = ACTIVITY_ICON[r.kind] || Pencil
                      return (
                        <li key={r.id}>
                          <span className={`sd-ico ${ACTIVITY_TONE[r.kind]}`}><Icon size={18} aria-hidden="true" /></span>
                          <div><strong>{r.text}</strong><small>{r.role} · {ago(r.at)}</small></div>
                        </li>
                      )
                    })}
                  </ul>
                )}
            </Panel>

            <Panel title="Gamified library" icon={Gamepad2} sub="Most played games in the selected range" link={{ to: '/admin/games-library/games', label: 'Games' }}>
              {first ? <Skel h={150} r={12} /> : data.topGames.length === 0 ? <Empty icon={Gamepad2}>No games were played in this range.</Empty> : (
                <div className="sd-table-wrap">
                  <table className="sd-table">
                    <thead><tr><th scope="col">Game</th><th scope="col">Plays</th><th scope="col">Accuracy</th><th scope="col">Status</th></tr></thead>
                    <tbody>
                      {data.topGames.map((g) => (
                        <tr key={g.id}>
                          <th scope="row">{g.name}</th>
                          <td><div className="sd-cap"><div className="sd-bar"><div style={{ width: `${g.playsPct}%` }} /></div><span>{g.plays}</span></div></td>
                          <td>{g.accuracy == null ? '—' : `${g.accuracy}%`}</td>
                          <td><span className={`br-pill ${g.status === 'published' ? 'green' : 'amber'} flat`}>{g.status.charAt(0).toUpperCase() + g.status.slice(1)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {branchModal && (
        <AddBranchModal
          branch={null}
          owners={branchModal.owners}
          existingBranches={branchModal.branches}
          onClose={() => setBranchModal(null)}
          onSaved={(_, kind) => {
            setBranchModal(null)
            setToast(kind === 'draft' ? 'Draft saved.' : 'Branch created.')
            clearTimeout(toastTimer.current)
            toastTimer.current = setTimeout(() => setToast(''), 3500)
            load()
          }}
        />
      )}
      {toast && <div className="br-toast" role="status"><CircleCheck size={16} /> {toast}</div>}
    </AdminPageShell>
  )
}
