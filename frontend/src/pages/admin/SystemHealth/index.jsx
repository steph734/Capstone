import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, Bell, Clock, Database as Db, RefreshCw, ShieldCheck } from 'lucide-react'
import AdminPageShell from '../AdminPageShell'
import { adminMenuItems } from '../adminSidebarConfig'
import { StatusPill } from './shared'
import { fmtTime } from '../../../downtime/time'
import Overview from './Overview'
import DatabaseTab from './DatabaseTab'
import SecurityTab from './SecurityTab'
import AlertsTab from './AlertsTab'
import './SystemHealth.css'

const TABS = [['overview', 'Overview', Activity], ['database', 'Database', Db], ['security', 'Security', ShieldCheck], ['alerts', 'Alerts', Bell]]
const tabFromHash = () => { const h = window.location.hash.replace('#', ''); return TABS.some((t) => t[0] === h) ? h : 'overview' }

export default function SystemHealthPage({ user, onLogout }) {
  const [tab, setTab] = useState(tabFromHash)
  const [range, setRange] = useState('24h')
  const [status, setStatus] = useState('unknown')
  const [stamp, setStamp] = useState(new Date())
  const [nonce, setNonce] = useState(0) // "Refresh" remounts the active tab, which fetches straight away
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  useEffect(() => { const on = () => setTab(tabFromHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on) }, [])
  const go = (k) => { window.location.hash = k; setTab(k) }
  const say = useCallback((text, bad = false) => { setToast({ text, bad }); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 4000) }, [])
  const onData = useCallback((d) => { setStatus(d.banner.overall); setStamp(new Date()) }, [])

  const pill = <StatusPill status={status}>{{ operational: 'All systems operational', degraded: 'Degraded performance', down: 'Service disruption', unknown: 'Checking…' }[status]}</StatusPill>
  return (
    <AdminPageShell user={user} onLogout={onLogout} title="System Health" subtitle="Live status of the app, MongoDB Atlas and security. Only you can see this page." menuItems={adminMenuItems} headerActions={pill}>
      <div className="sh-page">
        <div className="sh-toolbar">
          <div className="sh-tabs" role="tablist" aria-label="System health sections">
            {TABS.map(([k, label, I]) => <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="sh-panel" className={tab === k ? 'on' : ''} onClick={() => go(k)}><I size={15} aria-hidden="true" /> {label}</button>)}
          </div>
          <div className="sh-tools">
            <span className="sh-live"><i aria-hidden="true" /> Live, {fmtTime(stamp)}</span>
            <label className="sh-range"><Clock size={14} aria-hidden="true" /><select aria-label="Time range" value={range} onChange={(e) => setRange(e.target.value)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label>
            <button type="button" className="sh-btn" onClick={() => { setNonce((n) => n + 1); setStamp(new Date()) }}><RefreshCw size={14} aria-hidden="true" /> Refresh</button>
          </div>
        </div>
        <div id="sh-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={`${tab}-${nonce}`}>
          {tab === 'overview' && <Overview range={range} onData={onData} />}
          {tab === 'database' && <DatabaseTab />}
          {tab === 'security' && <SecurityTab toast={say} />}
          {tab === 'alerts' && <AlertsTab toast={say} />}
        </div>
      </div>
      {toast && <div className={`sh-toast${toast.bad ? ' bad' : ''}`} role="status">{toast.text}</div>}
    </AdminPageShell>
  )
}
