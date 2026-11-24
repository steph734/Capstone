import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Card, Chip, Switch, hapi, useLive } from './shared'
import { Overlay, useModal } from './IncidentModal'

const AREA = { service_health: 'Service health', database: 'Database', security: 'Security', system: 'System' }
const METRIC_LABEL = { error_rate: 'Error rate (%)', api_p95: 'API response p95 (ms)', db_connections_pct: 'MongoDB connections (%)', storage_pct: 'Storage used (%)', replica_lag: 'Replica lag (s)', failed_logins_2m: 'Failed logins in 2 minutes' }
const WINDOW = { 1: '1 in 2 minutes' }

export default function AlertsTab({ toast }) {
  const { data: d, error, loading, refresh } = useLive(() => hapi('rules'), [], 60000)
  const [adding, setAdding] = useState(false)
  const [p, setP] = useState(null)
  const [dl, setDl] = useState(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  if (!d) return <p className="sh-empty">{error || (loading ? 'Loading…' : '')}</p>
  const prot = p || d.protection, del = dl || d.delivery
  const run = async (key, action, body, msg) => { setBusy(key); setErr(''); try { await hapi(action, { method: 'POST', body }); toast(msg); setP(null); setDl(null); await refresh() } catch (e) { setErr(e.message); toast(e.message, true) } finally { setBusy('') } }
  const save = (r, patch) => run(`r${r.key}`, 'rule-save', { key: r.key, ...patch }, 'Alert rule updated.')
  const setPr = (path, v) => { const n = structuredClone(prot); let o = n; const parts = path.split('.'); parts.slice(0, -1).forEach((k) => { o = o[k] }); o[parts.at(-1)] = v; setP(n) }
  const setDe = (path, v) => { const n = structuredClone(del); let o = n; const parts = path.split('.'); parts.slice(0, -1).forEach((k) => { o = o[k] }); o[parts.at(-1)] = v; setDl(n) }
  return (
    <div className="sh-two alerts">
      <Card title="Alert rules" sub="Who is told, and how, when something goes wrong" right={<button type="button" className="sh-btn primary" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" /> Add rule</button>}>
        <div className="sh-table-wrap"><table className="sh-table"><thead><tr><th>RULE</th><th>AREA</th><th>SENT BY</th><th>ON</th></tr></thead>
          <tbody>{d.rules.map((r) => (
            <tr key={r.key}><td><b>{r.label}</b>{r.active && <Chip tone="red">Firing</Chip>}</td><td><Chip>{AREA[r.area]}</Chip></td>
              <td><div className="sh-chans">
                <button type="button" aria-pressed={r.channels.email} className={`sh-chan${r.channels.email ? ' on' : ''}`} disabled={busy === `r${r.key}`} onClick={() => save(r, { channels: { email: !r.channels.email } })}>Email</button>
                <button type="button" aria-pressed={r.channels.inApp} className={`sh-chan${r.channels.inApp ? ' on' : ''}`} disabled={busy === `r${r.key}`} onClick={() => save(r, { channels: { inApp: !r.channels.inApp } })}>In-app</button></div></td>
              <td><Switch checked={r.enabled} label={`${r.label}: ${r.enabled ? 'on' : 'off'}`} disabled={busy === `r${r.key}`} onChange={(v) => save(r, { enabled: v })} /></td></tr>))}</tbody></table></div>
      </Card>

      <div className="sh-stack">
        <Card title="Automatic protection" sub="TherapyPro acts first, then tells you">
          <Check label="Block an IP after repeated failed logins" sub="Locks out guessing attempts." checked={prot.blockAfterFailed.enabled} onChange={(v) => setPr('blockAfterFailed.enabled', v)} />
          <div className="sh-field2"><Num label="FAILED ATTEMPTS BEFORE BLOCK" value={prot.blockAfterFailed.attempts} min={3} max={20} unit="attempts" onChange={(v) => setPr('blockAfterFailed.attempts', v)} /><Num label="WITHIN" value={prot.blockAfterFailed.windowMin} min={1} max={10} unit="minutes" onChange={(v) => setPr('blockAfterFailed.windowMin', v)} /></div>
          <Num label="BLOCK LENGTH" value={prot.blockLengthMin} min={5} max={1440} unit="minutes" onChange={(v) => setPr('blockLengthMin', v)} />
          <Check label="Limit requests per IP" sub="Slows down bots and scrapers on pre-login pages." checked={prot.rateLimit.enabled} onChange={(v) => setPr('rateLimit.enabled', v)} />
          <Num label="REQUEST LIMIT" value={prot.rateLimit.perMinute} min={20} max={1000} unit="per minute" onChange={(v) => setPr('rateLimit.perMinute', v)} />
          <Check label={`Lock the account for ${prot.lockAccount.minutes} minutes`} sub="The owner can reset the password." checked={prot.lockAccount.enabled} onChange={(v) => setPr('lockAccount.enabled', v)} />
          <Num label="LOCK LENGTH" value={prot.lockAccount.minutes} min={5} max={60} unit="minutes" onChange={(v) => setPr('lockAccount.minutes', v)} />
          {p && <button type="button" className="sh-btn primary wide" disabled={busy === 'prot'} onClick={() => run('prot', 'protection-save', { protection: prot }, 'Protection settings saved.')}>{busy === 'prot' ? 'Saving…' : 'Save protection settings'}</button>}
        </Card>
        <Card title="Where alerts go">
          <Check label="Email" checked={del.email.enabled} onChange={(v) => setDe('email.enabled', v)} />
          <input type="email" className="sh-input" aria-label="Alert email address" placeholder="Email address" value={del.email.address || ''} onChange={(e) => setDe('email.address', e.target.value)} />
          <Check label="In-app bell" sub="Shows on every Super Admin page" checked={del.inApp.enabled} onChange={(v) => setDe('inApp.enabled', v)} />
          <Check label="Daily summary at 8:00 AM" sub="One email with the last 24 hours" checked={del.dailySummary.enabled} onChange={(v) => setDe('dailySummary.enabled', v)} />
          {dl && <button type="button" className="sh-btn primary wide" disabled={busy === 'del'} onClick={() => run('del', 'delivery-save', { delivery: del }, 'Alert delivery saved.')}>{busy === 'del' ? 'Saving…' : 'Save'}</button>}
        </Card>
        {err && <p className="sh-err" role="alert">{err}</p>}
      </div>
      {adding && <AddRule metrics={d.metrics} onClose={() => setAdding(false)} onSave={(body) => run('add', 'rule-add', body, 'Alert rule added.').then(() => setAdding(false))} busy={busy === 'add'} />}
    </div>
  )
}

const Check = ({ label, sub, checked, onChange }) => (
  <label className="sh-checkline"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span><b>{label}</b>{sub && <small>{sub}</small>}</span></label>
)
const Num = ({ label, value, min, max, unit, onChange }) => (
  <label className="sh-numfield"><span className="sh-label">{label}</span><span className="sh-numbox"><input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /><em>{unit}</em></span><small className="sh-muted">{min} to {max}</small></label>
)

function AddRule({ metrics, onClose, onSave, busy }) {
  const ref = useModal(onClose)
  const [f, setF] = useState({ metric: 'error_rate', operator: '>', threshold: 2, forMinutes: 5, email: true, inApp: true })
  return (
    <Overlay onClose={onClose}>
      <div ref={ref} className="sh-modal narrow" role="dialog" aria-modal="true" aria-labelledby="sh-add-t" tabIndex={-1}>
        <header><div><h2 id="sh-add-t">Add alert rule</h2><p>Pick a metric TherapyPro measures.</p></div></header>
        <label className="sh-label" htmlFor="sh-m">METRIC</label>
        <select id="sh-m" className="sh-input" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{Object.keys(metrics).map((k) => <option key={k} value={k}>{METRIC_LABEL[k] || k}</option>)}</select>
        <div className="sh-field2"><label><span className="sh-label">IS</span><select className="sh-input" value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })}><option value=">">above</option><option value=">=">at or above</option></select></label>
          <label><span className="sh-label">VALUE</span><input type="number" className="sh-input" min="0" value={f.threshold} onChange={(e) => setF({ ...f, threshold: Number(e.target.value) })} /></label></div>
        <label><span className="sh-label">FOR AT LEAST (MINUTES)</span><input type="number" className="sh-input" min="0" max="120" value={f.forMinutes} onChange={(e) => setF({ ...f, forMinutes: Number(e.target.value) })} /></label>
        <Check label="Email" checked={f.email} onChange={(v) => setF({ ...f, email: v })} /><Check label="In-app" checked={f.inApp} onChange={(v) => setF({ ...f, inApp: v })} />
        <footer><button type="button" className="sh-btn" onClick={onClose}>Cancel</button><button type="button" className="sh-btn primary" disabled={busy} onClick={() => onSave({ metric: f.metric, operator: f.operator, threshold: f.threshold, forMinutes: f.forMinutes, channels: { email: f.email, inApp: f.inApp } })}>{busy ? 'Adding…' : 'Add rule'}</button></footer>
      </div>
    </Overlay>
  )
}
