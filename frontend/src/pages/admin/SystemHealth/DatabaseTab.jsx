import { useState } from 'react'
import { AlertTriangle, Check, Clock, Database as Db, HardDrive, Search, Server, Users, Zap } from 'lucide-react'
import { Bar, Card, Chart, Chip, Empty, NotAvail, StatusPill, hapi, useLive } from './shared'

const mb = (b) => (b == null ? '-' : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export default function DatabaseTab() {
  const [q, setQ] = useState('')
  const { data: d, error, loading } = useLive(() => hapi('database', { query: { q } }), [q])
  if (!d) return <p className="sh-empty">{error || (loading ? 'Loading…' : '')}</p>
  const c = d.cluster
  const connPct = d.connections.max ? (d.connections.current / d.connections.max) * 100 : null
  const stPct = d.storage.maxMb ? (d.storage.mb / d.storage.maxMb) * 100 : null
  return (
    <div className="sh-stack">
      {error && <div className="sh-alert amber" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}. Showing the last data received.</div>}
      <Card>
        <div className="sh-dbhead"><span className="sh-ico green"><Db size={22} aria-hidden="true" /></span>
          <div><h3>MongoDB Atlas . therapypro <StatusPill status={c.status} /></h3>
            <p>{c.nodes ? `Replica set with ${c.nodes.length} node${c.nodes.length === 1 ? '' : 's'}` : <NotAvail reason={c.unavailable?.nodes} />}</p></div>
          <a className="sh-btn" href="https://cloud.mongodb.com" target="_blank" rel="noreferrer">Open in Atlas</a></div>
        {c.nodes && <div className="sh-nodes">{c.nodes.map((n, i) => (
          <div key={n.host}><Server size={18} aria-hidden="true" /><div><b>shard-00-0{i}</b><small>{n.role === 'PRIMARY' ? 'Accepts reads and writes' : `Replication lag ${n.lagSec != null ? `${n.lagSec} s` : 'not available'}`}</small></div><Chip tone={n.role === 'PRIMARY' ? 'green' : 'blue'}>{n.role}</Chip></div>))}</div>}
      </Card>

      <div className="sh-tiles">
        <Metric icon={Users} label="Connections" value={d.connections.current != null ? <>{d.connections.current} <small>of {d.connections.max}</small></> : null} note={d.connections.note} pct={connPct} />
        <Metric icon={Zap} label="Operations per second" value={d.opsPerSec.value != null ? <>{d.opsPerSec.value} <small>ops/s</small></> : null} note={d.opsPerSec.note || (d.opsPerSec.value == null ? 'Measured after two samples' : null)} />
        <Metric icon={HardDrive} label="Storage used" value={d.storage.mb != null ? <>{Math.round(d.storage.mb)} MB {d.storage.maxMb && <small>of {d.storage.maxMb} MB</small>}</> : null} note={d.storage.note} pct={stPct} />
        <Metric icon={Clock} label="Database response time" value={d.avgQueryMs != null ? <>{d.avgQueryMs} <small>ms ping</small></> : null} pct={d.avgQueryMs != null ? Math.min(100, d.avgQueryMs / 10) : null} />
      </div>

      <div className="sh-two">
        <Card title="Operations per second" sub="Reads and writes, last 24 hours"><Chart points={d.opsSeries} label="Operations per second" unit=" ops/s" color="#2B6B4F" /></Card>
        <Card title="Backups"><NotAvail reason={d.backups.reason} /><p className="sh-hint">Add ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_PROJECT_ID and ATLAS_CLUSTER_NAME to see snapshots here. Nothing is shown as succeeded until it is measured.</p></Card>
      </div>

      <Card title="Collections" sub="Document counts, size, indexes and validation rules" right={<label className="sh-search"><Search size={15} aria-hidden="true" /><input type="search" placeholder="Search collections" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search collections" /></label>}>
        {d.collections.length === 0 ? <Empty>No collections match.</Empty> : (
          <div className="sh-table-wrap"><table className="sh-table"><thead><tr><th>COLLECTION</th><th>DOCUMENTS</th><th>SIZE</th><th>INDEXES</th><th>VALIDATION</th><th>NOTES</th><th>HEALTH</th></tr></thead>
            <tbody>{d.collections.map((r) => (
              <tr key={r.name}><td><b><Db size={14} aria-hidden="true" /> {r.name}</b></td><td>{r.documents != null ? r.documents.toLocaleString() : '-'}</td><td>{mb(r.sizeBytes)}</td><td>{r.indexes ?? '-'}</td>
                <td><Chip tone={r.validation === 'strict' ? 'blue' : r.validation === 'moderate' ? 'grey' : 'amber'}>{r.validation === 'none' ? 'None' : r.validation[0].toUpperCase() + r.validation.slice(1)}</Chip></td><td className="sh-muted">{r.notes || '-'}</td>
                <td><Chip tone={r.health === 'healthy' ? 'green' : 'amber'}>{r.health === 'healthy' ? 'Healthy' : 'Check'}</Chip></td></tr>))}</tbody></table></div>)}
      </Card>

      <div className="sh-two">
        <Card title="Slow queries" sub="Over 100 ms today"><Empty>{d.slowQueries.note}</Empty></Card>
        <Card title="Data protection">
          <ul className="sh-checks">{d.protection.map((p) => (
            <li key={p.label}>{p.status === 'good' ? <Check size={16} className="ok" aria-hidden="true" /> : <AlertTriangle size={16} className={p.status === 'fix' ? 'warn' : 'muted'} aria-hidden="true" />}<span>{p.label}</span><Chip tone={p.status === 'good' ? 'green' : p.status === 'fix' ? 'amber' : 'grey'}>{p.status === 'good' ? 'Good' : p.status === 'fix' ? 'Fix' : 'Not checked'}</Chip>{p.note && <small className="sh-muted">{p.note}</small>}</li>))}</ul>
        </Card>
      </div>
    </div>
  )
}

function Metric({ icon: I, label, value, note, pct }) {
  return (
    <div className="sh-metric"><span className="sh-label"><I size={14} aria-hidden="true" /> {label}</span>
      <b>{value ?? <NotAvail reason={note} />}</b>{value != null && note && <small className="sh-muted">{note}</small>}
      {pct != null && <Bar pct={pct} tone={pct > 80 ? 'amber' : ''} />}</div>
  )
}
