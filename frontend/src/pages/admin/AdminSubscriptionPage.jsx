import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, ChevronRight, CircleCheck, CircleAlert, CreditCard, Download, FlaskConical, Plus, RefreshCw, TrendingDown, TrendingUp, TriangleAlert, Users, X,
} from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import PlanCard from './subscription/PlanCard'
import PlanModal from './subscription/PlanModal'
import { BetaDialog, DeleteDialog, FeaturesDialog, SubscribersDialog } from './subscription/PlanDialogs'
import { peso, tierTag } from './subscription/planConstants'
import { API_BASE } from '../../utils/api'
import { authFetch, getSessionToken } from '../../utils/session'
import './branches/Branches.css'
import './subscription/Subscription.css'

const EVENT_ICON = { upgrade: TrendingUp, new: Plus, downgrade: TrendingDown, cancel: X, warning: TriangleAlert }
const EVENT_TONE = { upgrade: 'green', new: 'green', downgrade: 'red', cancel: 'gray', warning: 'amber' }

function Skel({ h = 16, w = '100%', r = 8 }) {
  return <span className="sp-skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />
}

function Stat({ tile, icon: Icon, value, label, meta, metaTone = 'up' }) {
  return (
    <div className="sp-stat">
      <span className={`br-tile ${tile}`}><Icon size={22} aria-hidden="true" /></span>
      <div><strong>{value}</strong><span>{label}</span>{meta && <em className={metaTone}>{meta}</em>}</div>
    </div>
  )
}

const signed = (n) => `${n >= 0 ? '+' : '−'}${peso(Math.abs(n), { compact: true })}`

export default function AdminSubscriptionPage({ user, onLogout }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [dialog, setDialog] = useState(null) // { type, plan? }
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const toastTimer = useRef(null)

  const flash = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 5000)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const load = useCallback(async () => {
    setError('')
    try { setData(await authFetch('/api/admin/plans')) } catch (err) { setError(err.message) }
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (menuId == null) return undefined
    const close = () => setMenuId(null)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey) }
  }, [menuId])

  const open = (type, plan) => { setMenuId(null); setDialog({ type, plan }) }
  const close = useCallback(() => setDialog(null), [])
  const done = (msg, warning) => { setDialog(null); flash(warning ? `${msg} ${warning}` : msg); load() }

  const toggleHidden = async (plan) => {
    setMenuId(null)
    try {
      await authFetch(`/api/admin/plans/${plan.id}`, { method: 'PATCH', body: { action: plan.status === 'hidden' ? 'show' : 'hide' } })
      flash(plan.status === 'hidden' ? `${plan.name} is now Live.` : `${plan.name} is now hidden.`)
      load()
    } catch (err) { flash(err.message) }
  }
  const duplicate = async (plan) => {
    setMenuId(null)
    try {
      await authFetch('/api/admin/plans', { method: 'POST', body: { duplicateOf: plan.id } })
      flash(`${plan.name} duplicated as a hidden plan.`)
      load()
    } catch (err) { flash(err.message) }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/plans/subscribers?format=csv`, { headers: { Authorization: `Bearer ${getSessionToken()}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not export subscribers.')
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `therapypro-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (err) { flash(err.message) } finally { setExporting(false) }
  }

  const plans = data?.plans || []
  const features = data?.features || []
  const s = data?.stats
  const shown = plans.filter((p) => p.status !== 'hidden')
  const finite = (k) => shown.some((p) => p.limits[k] != null)

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="Subscription" subtitle="Plans, prices and features for every clinic on TherapyPro" icon="" menuItems={adminMenuItems}>
      <div className="sp-page br-page">
        <div className="sp-toolbar">
          <button type="button" className="br-btn outline" onClick={exportCsv} disabled={exporting || !data}><Download size={16} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export'}</button>
          <button type="button" className="br-btn primary" onClick={() => open('plan', null)} disabled={!data}><Plus size={17} aria-hidden="true" /> Add plan</button>
        </div>

        {error && (
          <div className="br-callout red" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{error}</span>
            <button type="button" className="br-btn outline sm sp-retry" onClick={load}><RefreshCw size={14} /> Try again</button></div>
        )}
        {data && !data.stripeAvailable && (
          <div className="br-callout" role="status"><TriangleAlert size={16} aria-hidden="true" /><span>Stripe could not be reached, so paid subscriber counts, revenue and recent changes are unavailable. Plans and Free accounts still come from the database.</span></div>
        )}

        <section className="sp-stats" aria-label="Summary">
          {!s ? Array.from({ length: 4 }, (_, i) => <div key={i} className="sp-stat"><Skel h={46} w={46} r={14} /><div style={{ flex: 1 }}><Skel h={26} w="40%" /><span style={{ display: 'block', marginTop: 8 }}><Skel w="70%" /></span></div></div>) : (
            <>
              <Stat tile="green" icon={Users} value={s.subscribers.value} label="Active subscribers"
                meta={s.subscribers.changePct == null ? 'No prior data' : `${s.subscribers.changePct >= 0 ? '+' : ''}${s.subscribers.changePct}% from last month`} metaTone={s.subscribers.changePct != null && s.subscribers.changePct < 0 ? 'down' : s.subscribers.changePct == null ? 'flat' : 'up'} />
              <Stat tile="yellow" icon={CreditCard} value={s.mrr.value == null ? '—' : peso(s.mrr.value, { compact: true })} label="Monthly recurring revenue"
                meta={s.mrr.change == null ? 'Unavailable' : `${signed(s.mrr.change)} from last month`} metaTone={s.mrr.change == null ? 'flat' : s.mrr.change < 0 ? 'down' : 'up'} />
              <Stat tile="blue" icon={CreditCard} value={s.plans.total} label="Plans" meta={s.plans.popular ? `Most popular: ${s.plans.popular}` : 'No subscribers yet'} metaTone={s.plans.popular ? 'up' : 'flat'} />
              <Stat tile="purple" icon={FlaskConical} value={s.beta.count} label="Beta testers" meta={s.beta.plan ? `Testing the ${s.beta.plan}` : 'No beta plans'} metaTone={s.beta.plan ? 'up' : 'flat'} />
            </>
          )}
        </section>

        <section className="sp-grid" aria-label="Plans">
          {!data ? [0, 1, 2].map((i) => <div key={i} className="sp-card"><Skel h={48} w={48} r={14} /><Skel h={28} w="50%" /><Skel h={90} r={12} /><Skel h={120} r={12} /></div>)
            : plans.length === 0 ? <div className="sp-empty">No plans yet. Use Add plan to create the first one.</div>
            : plans.map((p) => (
              <PlanCard key={p.id} plan={p} features={features} menuOpen={menuId === p.id} onMenu={setMenuId}
                onSubscribers={(pl) => open('subscribers', pl)} onEdit={(pl) => open('plan', pl)} onBeta={(pl) => open('beta', pl)}
                onToggleHidden={toggleHidden} onDuplicate={duplicate} onDelete={(pl) => open('delete', pl)} />
            ))}
        </section>

        <div className="sp-row">
          <section className="sp-panel">
            <header className="sp-panel-head">
              <div><h2><CircleCheck size={17} aria-hidden="true" /> Compare plans</h2><p>What each plan includes</p></div>
              <button type="button" className="sp-link" onClick={() => open('features')} disabled={!data}>Edit features <ChevronRight size={15} aria-hidden="true" /></button>
            </header>
            {!data ? <Skel h={180} r={12} /> : shown.length === 0 || features.length === 0 ? <div className="sp-empty">Nothing to compare yet.</div> : (
              <div className="sp-table-wrap">
                <table className="sp-table compare">
                  <thead><tr><th scope="col">Feature</th>{shown.map((p) => <th key={p.id} scope="col" className="c">{p.name}</th>)}</tr></thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.id}>
                        <th scope="row">{f.label}<small>{tierTag(f, plans)}</small></th>
                        {shown.map((p) => (
                          <td key={p.id} className="c">{p.featureKeys.includes(f.key) ? <Check size={17} className="yes" aria-label="Included" /> : <X size={17} className="no" aria-label="Not included" />}</td>
                        ))}
                      </tr>
                    ))}
                    {[['branches', 'Branches'], ['therapists', 'Therapists'], ['patients', 'Patients']].filter(([k]) => k === 'branches' || finite(k)).map(([k, label]) => (
                      <tr key={k}>
                        <th scope="row">{label}</th>
                        {shown.map((p) => <td key={p.id} className="c val">{p.limits[k] == null ? 'Unlimited' : p.limits[k]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sp-panel">
            <header className="sp-panel-head">
              <div><h2><RefreshCw size={17} aria-hidden="true" /> Recent changes</h2><p>Upgrades, downgrades and cancellations</p></div>
            </header>
            {!data ? <div className="sp-skel-list">{[0, 1, 2, 3].map((i) => <Skel key={i} h={44} r={10} />)}</div> : data.changes.length === 0 ? (
              <div className="sp-empty">{data.stripeAvailable ? 'No subscription changes yet.' : 'Subscription events come from Stripe, which is unavailable right now.'}</div>
            ) : (
              <ul className="sp-changes">
                {data.changes.map((c, i) => {
                  const Icon = EVENT_ICON[c.kind] || RefreshCw
                  return (
                    <li key={`${c.kind}-${i}`}>
                      <span className={`sp-ico ${EVENT_TONE[c.kind]}`}><Icon size={18} aria-hidden="true" /></span>
                      <div><strong>{c.title}</strong><small>{c.detail}</small></div>
                      {c.amount != null ? <b className={c.amount >= 0 ? 'up' : 'down'}>{signed(c.amount)}</b>
                        : c.action ? <button type="button" className="sp-link" onClick={() => open('subscribers', null)}>View</button> : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {dialog?.type === 'plan' && <PlanModal plan={dialog.plan} plans={plans} features={features} onClose={close} onSaved={done} />}
      {dialog?.type === 'subscribers' && <SubscribersDialog plan={dialog.plan} onClose={close} />}
      {dialog?.type === 'beta' && <BetaDialog plan={dialog.plan} onClose={close} onSaved={done} />}
      {dialog?.type === 'delete' && <DeleteDialog plan={dialog.plan} onClose={close} onDeleted={done} />}
      {dialog?.type === 'features' && <FeaturesDialog features={features} plans={plans} onClose={close} onChanged={load} />}
      {toast && <div className="br-toast" role="status"><CircleCheck size={16} /> {toast}</div>}
    </AdminPageShell>
  )
}
