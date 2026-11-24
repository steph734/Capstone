import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, Globe, Info, Lock, ShieldCheck, Zap } from 'lucide-react'
import { Bar, Card, Chip, Empty, hapi, useLive } from './shared'
import IncidentModal from './IncidentModal'
import RiskModal from './RiskModal'
import { fmtTime } from '../../../downtime/time'

const PARTS = { accounts: 'Accounts and access', data: 'Data protection', network: 'Network', monitoring: 'Monitoring' }
const LVL = { high: ['red', 'High'], medium: ['amber', 'Medium'], low: ['blue', 'Low'], info: ['blue', 'Info'] }
const R = 54, C = 2 * Math.PI * R
const ACTION = { restrict: 'Restrict', remind: 'Remind', rotate: 'Rotate', retention: 'Change' }

export default function SecurityTab({ toast }) {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null) // event id
  const [risk, setRisk] = useState(null)
  const { data: d, error, loading, refresh } = useLive(() => hapi('security', { query: { page } }), [page])
  if (!d) return <p className="sh-empty">{error || (loading ? 'Loading…' : '')}</p>
  const s = d.score, c = d.counters
  const tone = s.total >= 80 ? '#16A34A' : s.total >= 60 ? '#D99A0B' : '#DC2626'
  const max = Math.max(1, ...d.failedByHour.map((h) => h.n))
  return (
    <div className="sh-stack">
      {error && <div className="sh-alert amber" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}. Showing the last data received.</div>}
      <div className="sh-two">
        <Card className="sh-scorecard">
          <div className="sh-score">
            <div className="sh-ring" role="img" aria-label={`Security score ${s.total} out of 100`}>
              <svg viewBox="0 0 130 130" width="150" height="150"><circle cx="65" cy="65" r={R} fill="none" stroke="#EEF2F0" strokeWidth="10" /><circle cx="65" cy="65" r={R} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - s.total / 100)} transform="rotate(-90 65 65)" /></svg>
              <div><b>{s.total}</b><small>OUT OF 100</small></div></div>
            <div><h3>Security score</h3><Chip tone={s.total >= 80 ? 'green' : s.total >= 60 ? 'amber' : 'red'}>{s.total >= 80 ? 'Good' : s.total >= 60 ? 'Fair' : 'At risk'}</Chip>{s.hint && <p className="sh-hint">{s.hint}</p>}</div>
          </div>
          <ul className="sh-parts">{s.parts.map((p) => <li key={p.key}><span>{PARTS[p.key]}</span><b>{p.score}</b><Bar pct={p.score} tone={p.score < 80 ? 'amber' : ''} /></li>)}</ul>
          {!s.networkChecked && <p className="sh-hint"><Info size={13} aria-hidden="true" /> Network access is not checked until Atlas API keys are connected.</p>}
        </Card>
        <Card title="Open risks" sub="Things to fix, most serious first" right={<Chip tone={d.risks.length ? 'amber' : 'green'}>{d.risks.length} open</Chip>}>
          {d.risks.length === 0 ? <Empty>No open risks.</Empty> : (
            <ul className="sh-risks">{d.risks.map((r) => (
              <li key={r.key}><span className={`sh-ico ${LVL[r.level][0]}`}><AlertTriangle size={18} aria-hidden="true" /></span><div><b>{r.title}</b><small>{r.detail}</small></div><Chip tone={LVL[r.level][0]}>{LVL[r.level][1]}</Chip>
                {r.actionKey && <button type="button" className="sh-btn" onClick={() => setRisk(r)}>{ACTION[r.actionKey]}</button>}</li>))}</ul>)}
        </Card>
      </div>

      <div className="sh-tiles five">
        <Count icon={Lock} tone="amber" n={c.failedLogins} label="Failed logins" note={`${c.failedDelta >= 0 ? '+' : ''}${c.failedDelta} vs yesterday`} warn={c.failedDelta > 0} />
        <Count icon={Ban} tone="red" n={c.blockedIps} label="Blocked IPs" note="Active blocks" />
        <Count icon={Globe} tone="violet" n={c.newCountry} label="New country" note={c.newCountry ? 'Needs review' : 'None'} warn={c.newCountry > 0} />
        <Count icon={Zap} tone="blue" n={c.rateLimited} label="Rate limited" note="Handled automatically" />
        <Count icon={ShieldCheck} tone="green" n={c.injections} label="Injections" note={c.injections ? 'Rejected' : 'None found'} />
      </div>

      <div className="sh-two">
        <Card title="Failed logins by hour" sub="Last 24 hours">
          <div className="sh-bars" role="img" aria-label="Failed logins by hour">{d.failedByHour.map((h) => <i key={h.hour} title={`${fmtTime(h.hour)}: ${h.n}`} className={h.n >= 5 ? 'red' : h.n ? 'amber' : ''} style={{ height: `${Math.max(3, (h.n / max) * 100)}%` }} />)}</div>
          <p className="sh-label">TOP SOURCES</p>
          {d.topSources.length === 0 ? <Empty>No failed logins in the last 24 hours.</Empty> : <ul className="sh-src">{d.topSources.map((t) => <li key={t.ip}><Globe size={14} aria-hidden="true" /><code>{t.ip}</code><b>{t.count}</b><Chip tone={t.blocked ? 'red' : 'amber'}>{t.blocked ? 'Blocked' : 'Watching'}</Chip></li>)}</ul>}
        </Card>
        <Card title="Security events" sub="Newest first" right={<Link className="sh-link" to="/admin/audit-logs">View audit logs</Link>}>
          {d.events.length === 0 ? <Empty>No security events in the last 24 hours.</Empty> : (
            <div className="sh-table-wrap"><table className="sh-table sh-stackable"><thead><tr><th>TIME</th><th>EVENT</th><th>LEVEL</th><th /></tr></thead>
              <tbody>{d.events.map((e) => (
                <tr key={e.id}><td data-l="Time" className="sh-muted">{fmtTime(e.time)}</td><td data-l="Event"><b>{e.title}</b><small>{e.sub}</small></td><td data-l="Level"><Chip tone={LVL[e.level][0]}>{LVL[e.level][1]}</Chip></td>
                  <td><button type="button" className="sh-btn" onClick={() => setOpen(e.id)}>{e.level === 'info' || e.status === 'resolved' ? 'View' : 'Review'}</button></td></tr>))}</tbody></table></div>)}
          {d.total > 20 && <div className="sh-pager"><button type="button" className="sh-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="sh-btn" disabled={page * 20 >= d.total} onClick={() => setPage(page + 1)}>Next</button></div>}
        </Card>
      </div>
      {open && <IncidentModal id={open} onClose={() => setOpen(null)} onChanged={(m) => { toast(m); refresh() }} />}
      {risk && <RiskModal risk={risk} onClose={() => setRisk(null)} onDone={(m) => { setRisk(null); toast(m); refresh() }} />}
    </div>
  )
}
const Count = ({ icon: I, tone, n, label, note, warn }) => <div className="sh-tile"><span className={`sh-ico ${tone}`}><I size={20} aria-hidden="true" /></span><div><b>{n}</b><small>{label}</small><em className={warn ? 'warn' : 'ok'}>{note}</em></div></div>
