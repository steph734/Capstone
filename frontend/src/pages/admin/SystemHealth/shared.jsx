import { useCallback, useEffect, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { authFetch } from '../../../utils/session'
import { fmtTime, fmtDate } from '../../../downtime/time'

// One call to the single health handler. Errors carry the server's readable message.
export async function hapi(action, { method = 'GET', query = {}, body } = {}) {
  try {
    const res = await authFetch('/api/admin/system-health', { method, query: { action, ...query }, body })
    return res.data
  } catch (e) { throw new Error(e.data?.message || e.message || "Couldn't reach the server") }
}

// Polls every `ms` while the tab is visible; pauses when hidden; keeps the last data on failure (never shows zeros as healthy).
export function useLive(fn, deps, ms = 30000) {
  const [state, setState] = useState({ data: null, error: '', loading: true, at: null })
  const alive = useRef(true)
  const run = useCallback(async () => {
    try { const data = await fn(); if (alive.current) setState({ data, error: '', loading: false, at: new Date() }) } catch (e) { if (alive.current) setState((s) => ({ ...s, error: "Couldn't reach the server", detail: e.message, loading: false })) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    alive.current = true
    setState((s) => ({ ...s, loading: true }))
    run()
    const tick = () => { if (document.visibilityState === 'visible') run() }
    const t = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => { alive.current = false; clearInterval(t); document.removeEventListener('visibilitychange', tick) }
  }, [run, ms])
  return { ...state, refresh: run }
}

const TONE = { operational: 'green', healthy: 'green', degraded: 'amber', down: 'red', unknown: 'grey' }
const TEXT = { operational: 'Operational', degraded: 'Degraded', down: 'Down', unknown: 'Unknown', healthy: 'Healthy' }
export const StatusPill = ({ status, children }) => <span className={`sh-pill ${TONE[status] || 'grey'}`}><i aria-hidden="true" />{children || TEXT[status] || status}</span>
export const Chip = ({ tone = 'grey', children }) => <span className={`sh-chip ${tone}`}>{children}</span>
export const NotAvail = ({ reason }) => <span className="sh-na">{reason || 'Not available on this plan'}</span>
export const Empty = ({ children }) => <p className="sh-empty">{children}</p>
export const Card = ({ title, sub, right, children, className = '' }) => (
  <section className={`sh-card ${className}`}>
    {(title || right) && <header><div>{title && <h3>{title}</h3>}{sub && <p>{sub}</p>}</div>{right}</header>}
    {children}
  </section>
)
export const Tile = ({ icon: Icon, tone = 'blue', value, label, note, noteTone }) => (
  <div className="sh-tile"><span className={`sh-ico ${tone}`}><Icon size={20} aria-hidden="true" /></span><div><b>{value}</b><small>{label}</small>{note && <em className={noteTone}>{note}</em>}</div></div>
)
export const Switch = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`sh-switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}><i /></button>
)
export const Bar = ({ pct, tone }) => <div className="sh-bar"><i className={tone} style={{ width: `${Math.min(100, Math.max(2, pct || 0))}%` }} /></div>
export const ago = (iso) => { if (!iso) return 'never'; const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000)); return s < 90 ? `${s} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago` }

// Responsive SVG chart (recharts) with a keyboard-reachable "View as table".
export function Chart({ points, unit = '', color = '#16A34A', height = 240, label }) {
  const [table, setTable] = useState(false)
  if (!points?.length) return <Empty>No data yet. Samples are collected about once a minute.</Empty>
  const fmt = (t) => new Date(t).toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', ...(points.length > 60 ? {} : {}) })
  return (
    <div className="sh-chart" style={{ minWidth: 0 }}>
      {table ? (
        <div className="sh-table-wrap"><table className="sh-table"><caption className="sh-sr">{label}</caption><thead><tr><th scope="col">Time (Manila)</th><th scope="col">Value</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.t}><td>{fmtDate(p.t)}, {fmtTime(p.t)}</td><td>{p.v}{unit}</td></tr>)}</tbody></table></div>
      ) : (
        <div role="img" aria-label={label} style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs><linearGradient id={`g${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".22" /><stop offset="100%" stopColor={color} stopOpacity=".02" /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#EEF2F0" />
              <XAxis dataKey="t" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#5B7469' }} tickLine={false} axisLine={false} minTickGap={36} />
              <YAxis tick={{ fontSize: 11, fill: '#5B7469' }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
              <Tooltip labelFormatter={(t) => `${fmtDate(t)}, ${fmtTime(t)}`} formatter={(v) => [`${v}${unit}`, label]} />
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#g${color.slice(1)})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <button type="button" className="sh-link" onClick={() => setTable((v) => !v)}>{table ? 'View as chart' : 'View as table'}</button>
    </div>
  )
}
