import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bug, CheckCircle2, Cloud, CreditCard, Database as Db, Globe, Lock, Mail, MessageSquare, Server, Users, Wrench, Zap } from 'lucide-react'
import { Card, Chart, Chip, Empty, StatusPill, Tile, hapi, useLive } from './shared'
import { fmtDate, fmtRange, fmtTime } from '../../../downtime/time'

const SVC_ICON = { web: Globe, api: Server, mongodb: Db, email: Mail, payments: CreditCard, voice_ai: MessageSquare }
const METRICS = [['response', 'Response time', ' ms'], ['errors', 'Error rate', '%'], ['requests', 'Requests', '']]

export default function Overview({ range, onData }) {
  const [metric, setMetric] = useState('response')
  const { data: d, error, loading } = useLive(async () => { const r = await hapi('overview', { query: { metric, range } }); onData?.(r); return r }, [metric, range])
  if (!d) return <p className="sh-empty">{error || (loading ? 'Loading…' : '')}</p>
  const b = d.banner
  const m = METRICS.find((x) => x[0] === metric)
  const noData = !d.sampleAt
  const sig = d.signedIn
  return (
    <div className="sh-stack">
      {error && <div className="sh-alert amber" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}. Showing the last data received.</div>}
      {b.overall !== 'operational' && b.message && (
        <div className="sh-alert amber" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{b.message}</span>
          <button type="button" className="sh-btn" onClick={() => { window.location.hash = 'database' }}><Db size={14} aria-hidden="true" /> Open database</button>
          <Link className="sh-btn" to="/admin/system-maintenance"><Wrench size={14} aria-hidden="true" /> Schedule downtime</Link></div>
      )}
      <section className={`sh-hero ${b.overall}`}>
        <span className="sh-hero-ico">{b.overall === 'operational' ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}</span>
        <div className="sh-hero-main"><h2>{b.overall === 'operational' ? 'All systems operational' : b.overall === 'degraded' ? 'Performance is degraded' : b.overall === 'down' ? 'Service disruption' : 'Waiting for data'}</h2>
          <p>{noData ? 'No health sample has been recorded yet.' : `Checked ${new Date(d.sampleAt).getTime() ? Math.max(1, Math.round((Date.now() - Date.parse(d.sampleAt)) / 1000)) : 0} s ago. ${b.healthy} of ${b.total} services healthy`}</p></div>
        <div className="sh-hero-stat"><b>{d.uptime.pct != null ? `${d.uptime.pct}%` : 'n/a'}</b><small>UPTIME (30 DAYS){d.uptime.pct == null ? '' : d.uptime.spanHours < 720 ? ` · ${d.uptime.spanHours} h of data` : ''}</small></div>
        <div className="sh-hero-stat"><b>{d.incidents30}</b><small>INCIDENTS (30 DAYS)</small></div>
        <div className="sh-hero-stat"><b>{d.avgMs != null ? `${d.avgMs.toLocaleString()} ms` : 'n/a'}</b><small>AVERAGE RESPONSE</small></div>
      </section>

      <div className="sh-tiles">
        <Tile icon={Zap} tone="violet" value={d.p95 != null ? `${d.p95.toLocaleString()} ms` : 'n/a'} label="API response (p95)" note={d.p95 == null ? 'No requests measured yet' : d.p95 > 1500 ? 'Slow' : 'Normal'} noteTone={d.p95 > 1500 ? 'bad' : 'ok'} />
        <Tile icon={Bug} tone="red" value={d.errorRate != null ? `${d.errorRate}%` : 'n/a'} label="Error rate" note={d.errorRate == null ? 'No requests measured yet' : d.errorRate > 1 ? 'Above 1% target' : 'Under 1% target'} noteTone={d.errorRate > 1 ? 'bad' : 'ok'} />
        <Tile icon={Users} tone="green" value={sig ? sig.total : 'n/a'} label="Signed in now" note="All roles" />
        <Tile icon={Lock} tone="amber" value={d.failedLogins.total} label="Failed logins (24 h)" note={d.failedLogins.topIp ? `${d.failedLogins.topIpCount} from one IP${d.failedLogins.blockedIps ? ', blocked' : ''}` : 'None'} noteTone={d.failedLogins.topIp ? 'warn' : 'ok'} />
      </div>

      <div className="sh-two">
        <Card title="Response time" sub={`API p95, last ${range === '7d' ? '7 days' : '24 hours'}`} right={<div className="sh-seg" role="group" aria-label="Chart metric">{METRICS.map(([k, l]) => <button type="button" key={k} aria-pressed={metric === k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{l}</button>)}</div>}>
          <Chart points={d.series} unit={m[2]} label={m[1]} color={metric === 'errors' ? '#DC2626' : '#16A34A'} />
          {d.seriesStats && <div className="sh-mini"><div><small>AVERAGE</small><b>{d.seriesStats.avg}{m[2]}</b></div><div><small>PEAK</small><b>{d.seriesStats.peak}{m[2]} at {fmtTime(d.seriesStats.peakAt)}</b></div><div><small>LOWEST</small><b>{d.seriesStats.low}{m[2]} at {fmtTime(d.seriesStats.lowAt)}</b></div></div>}
        </Card>
        <Card title="Services">
          <ul className="sh-svc">
            {d.services.length === 0 && <Empty>No services checked yet.</Empty>}
            {d.services.map((s) => { const I = SVC_ICON[s.key] || Cloud; return (
              <li key={s.key}><span className="sh-ico grey"><I size={18} aria-hidden="true" /></span><div><b>{s.label}</b><small>{s.sub}</small></div><span className="sh-ms">{s.latencyMs != null ? (s.latencyMs >= 1000 ? `${(s.latencyMs / 1000).toFixed(1)} s` : `${s.latencyMs} ms`) : ''}</span><StatusPill status={s.status} /></li>) })}
          </ul>
        </Card>
      </div>

      <div className="sh-two even">
        <Card title="Recent incidents" right={<Link className="sh-link" to="/admin/audit-logs">View all</Link>}>
          {d.incidents.length === 0 ? <Empty>No incidents recorded.</Empty> : (
            <ul className="sh-inc">{d.incidents.map((i) => (
              <li key={i.id}><i className={i.status === 'investigating' ? 'amber' : i.status === 'completed' ? 'blue' : 'green'} aria-hidden="true" />
                <div><b>{i.title}</b><small>{fmtDate(i.startedAt, { year: undefined })}{i.minutes ? ` . ${i.minutes} min` : ''}</small></div>
                <Chip tone={i.status === 'investigating' ? 'amber' : i.status === 'completed' ? 'blue' : 'green'}>{i.status === 'investigating' ? 'Investigating' : i.status === 'completed' ? 'Completed' : 'Resolved'}</Chip></li>))}</ul>
          )}
        </Card>
        <Card title="Next planned maintenance">
          {d.next ? <div className="sh-next"><span className="sh-ico amber"><Wrench size={20} aria-hidden="true" /></span><div><b>{d.next.title}</b><small>{fmtDate(d.next.startAt)} . {fmtRange(d.next.startAt, d.next.endAt)}</small></div><Link className="sh-link" to="/admin/system-maintenance">Manage</Link></div> : <Empty>No downtime is scheduled.</Empty>}
          <p className="sh-label">SIGNED IN NOW</p>
          {sig ? <div className="sh-tri"><div><b>{sig.owners}</b><small>Owners</small></div><div><b>{sig.therapists}</b><small>Therapists</small></div><div><b>{sig.patients}</b><small>Patients</small></div></div> : <Empty>Not measured yet.</Empty>}
        </Card>
      </div>
    </div>
  )
}
