import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, ListChecks, Search, Trash2, Users, X, Plus } from 'lucide-react'
import { authFetch } from '../../../utils/session'
import { peso, tierTag } from './planConstants'

// Small dialog shell: backdrop click and Esc close it.
export function Dialog({ title, icon: Icon, onClose, wide, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="br-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`br-modal small${wide ? ' wide sp-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="br-modal-head">
          {Icon && <span className="br-tile dark"><Icon size={22} aria-hidden="true" /></span>}
          <div><h2>{title}</h2></div>
          <button type="button" className="br-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

export function SubscribersDialog({ plan, onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], available: true, error: '' })
  const [q, setQ] = useState('')
  useEffect(() => {
    let alive = true
    authFetch('/api/admin/plans/subscribers', { query: plan ? { plan: plan.slug } : {} })
      .then((d) => alive && setState({ loading: false, rows: d.subscribers, available: d.available, error: '' }))
      .catch((err) => alive && setState({ loading: false, rows: [], available: true, error: err.message }))
    return () => { alive = false }
  }, [plan])
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase()
    return n ? state.rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(n)) : state.rows
  }, [state.rows, q])

  return (
    <Dialog title={plan ? `${plan.name} subscribers` : 'All subscribers'} icon={Users} onClose={onClose} wide>
      <div className="br-modal-body">
        {!state.available && <p className="br-callout"><span>Paid subscribers come from Stripe, which could not be reached. Only the list of Free accounts is shown.</span></p>}
        <label className="br-search sp-search"><Search size={16} aria-hidden="true" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" aria-label="Search subscribers" /></label>
        {state.loading ? <p className="br-hint">Loading…</p> : state.error ? <p className="br-form-error" role="alert">{state.error}</p> : rows.length === 0 ? (
          <p className="br-hint">No subscribers match.</p>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead><tr><th scope="col">Subscriber</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col">Since</th><th scope="col">Renews</th><th scope="col">Monthly</th></tr></thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.email}-${i}`}>
                    <th scope="row"><span>{r.name}</span><small>{r.email}</small></th>
                    <td>{r.plan}</td>
                    <td><span className={`sp-pill ${r.status === 'active' || r.status === 'free' ? 'green' : r.status === 'past_due' ? 'red' : 'gray'} soft`}>{r.status.replace('_', ' ')}</span></td>
                    <td>{fmtDate(r.since)}</td>
                    <td>{fmtDate(r.renews)}</td>
                    <td>{r.monthly ? peso(r.monthly) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="br-hint">Showing the first 200. Use Export for the full list.</p>}
          </div>
        )}
      </div>
      <footer className="br-modal-foot"><span className="br-spacer" /><button type="button" className="br-btn outline" onClick={onClose}>Close</button></footer>
    </Dialog>
  )
}

export function BetaDialog({ plan, onClose, onSaved }) {
  const [emails, setEmails] = useState(plan.betaTesters)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const add = () => {
    const e = input.trim().toLowerCase()
    if (!e) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Enter a valid email address.'); return }
    if (!emails.includes(e)) setEmails([...emails, e])
    setInput(''); setError('')
  }
  const save = async () => {
    setBusy(true); setError('')
    try {
      await authFetch(`/api/admin/plans/${plan.id}`, { method: 'PATCH', body: { action: 'beta_testers', emails } })
      onSaved('Beta testers updated.')
    } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Dialog title={`${plan.name} beta testers`} icon={FlaskConical} onClose={onClose}>
      <div className="br-modal-body">
        <p className="br-hint" style={{ marginTop: 0 }}>Beta plans are only visible to these accounts. Each email must belong to an existing TherapyPro account.</p>
        <div className="sp-add-feature">
          <div className={`br-input${error ? ' has-error' : ''}`}>
            <input type="email" value={input} placeholder="tester@example.com" aria-label="Tester email" autoFocus onChange={(e) => { setInput(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
          </div>
          <button type="button" className="br-btn primary sm" onClick={add}><Plus size={15} /> Add</button>
        </div>
        {error && <p className="br-error" role="alert">{error}</p>}
        {emails.length === 0 ? <p className="br-hint">No beta testers yet.</p> : (
          <ul className="sp-tester-list">
            {emails.map((e) => (
              <li key={e}><span>{e}</span><button type="button" className="sp-icon-btn" aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter((x) => x !== e))}><X size={15} /></button></li>
            ))}
          </ul>
        )}
      </div>
      <footer className="br-modal-foot">
        <span className="br-spacer" />
        <button type="button" className="br-btn outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="br-btn primary" onClick={save} disabled={busy}>Save testers</button>
      </footer>
    </Dialog>
  )
}

export function DeleteDialog({ plan, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    setBusy(true); setError('')
    try { await authFetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE' }); onDeleted('Plan deleted.') } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Dialog title="Delete plan?" icon={Trash2} onClose={onClose}>
      <div className="br-modal-body">
        <p>{plan.name} Plan will be removed permanently. It has no subscribers, so nobody loses access.</p>
        {error && <p className="br-form-error" role="alert">{error}</p>}
      </div>
      <footer className="br-modal-foot">
        <span className="br-spacer" />
        <button type="button" className="br-btn outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="br-btn danger" onClick={go} disabled={busy}>Delete plan</button>
      </footer>
    </Dialog>
  )
}

// Edit the shared feature list that feeds every plan and the Compare plans table.
export function FeaturesDialog({ features, plans, onClose, onChanged }) {
  const [rows, setRows] = useState(features)
  const [error, setError] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const used = (key) => plans.some((p) => p.featureKeys.includes(key))

  const patch = async (f, body) => {
    setError('')
    try { await authFetch(`/api/admin/plan-features/${f.id}`, { method: 'PATCH', body }); onChanged() } catch (err) { setError(err.message) }
  }
  const remove = async (f) => {
    setError('')
    try { await authFetch(`/api/admin/plan-features/${f.id}`, { method: 'DELETE' }); setRows((r) => r.filter((x) => x.id !== f.id)); onChanged() } catch (err) { setError(err.message) }
  }
  const add = async () => {
    setError('')
    try {
      const { feature } = await authFetch('/api/admin/plan-features', { method: 'POST', body: { label: newLabel } })
      setRows((r) => [...r, feature]); setNewLabel(''); onChanged()
    } catch (err) { setError(err.fields?.label || err.message) }
  }

  return (
    <Dialog title="Edit features" icon={ListChecks} onClose={onClose} wide>
      <div className="br-modal-body">
        <p className="br-hint" style={{ marginTop: 0 }}>These features are shared by every plan. Rename them or set the lowest plan that includes them. Tick them on each plan with Edit plan.</p>
        <ul className="sp-edit-features">
          {rows.map((f) => (
            <li key={f.id}>
              <input defaultValue={f.label} maxLength={60} aria-label={`Name of ${f.label}`}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== f.label) { setRows((r) => r.map((x) => (x.id === f.id ? { ...x, label: v } : x))); patch(f, { label: v }) } else e.target.value = f.label }} />
              <select value={f.minTier || ''} aria-label={`Lowest plan with ${f.label}`}
                onChange={(e) => { const v = e.target.value || null; setRows((r) => r.map((x) => (x.id === f.id ? { ...x, minTier: v } : x))); patch(f, { minTier: v }) }}>
                <option value="">New</option>
                <option value="all">All plans</option>
                {plans.map((p) => <option key={p.slug} value={p.slug}>{tierTag({ minTier: p.slug }, plans)}</option>)}
              </select>
              <button type="button" className="sp-icon-btn" disabled={used(f.key)} aria-label={`Delete ${f.label}`} title={used(f.key) ? 'A plan still includes this feature' : 'Delete feature'} onClick={() => remove(f)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
        <div className="sp-add-feature" style={{ marginTop: 12 }}>
          <div className="br-input"><input value={newLabel} placeholder="New feature name" aria-label="New feature name" maxLength={60} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} /></div>
          <button type="button" className="br-btn primary sm" onClick={add}><Plus size={15} /> Add</button>
        </div>
        {error && <p className="br-form-error" role="alert">{error}</p>}
      </div>
      <footer className="br-modal-foot"><span className="br-spacer" /><button type="button" className="br-btn outline" onClick={onClose}>Done</button></footer>
    </Dialog>
  )
}
