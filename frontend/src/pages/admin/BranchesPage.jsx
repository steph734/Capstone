import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Archive, ArchiveRestore, Building2, CircleCheck, Clock, ChevronDown, ClipboardCheck, Eye, EllipsisVertical,
  LayoutGrid, List, Map as MapIcon, MapPin, Pencil, Phone, Plus, Search, Stethoscope, TriangleAlert, X, Info,
} from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import AddBranchModal from './branches/AddBranchModal'
import { DAYS, STATUS_META, initials } from './branches/branchConstants'
import { authFetch } from '../../utils/session'
import './branches/Branches.css'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'review', label: 'Under review' },
  { key: 'archived', label: 'Archived' },
]
const SORTS = [
  { key: 'therapists', label: 'Most therapists' },
  { key: 'newest', label: 'Newest' },
  { key: 'az', label: 'A–Z' },
]

const matchesTab = (b, tab) => {
  if (tab === 'archived') return b.status === 'Archived'
  if (b.status === 'Archived') return false
  if (tab === 'active') return b.status === 'Active'
  if (tab === 'review') return b.status === 'Under review'
  return true
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '')

function StatusPill({ status }) {
  const tone = STATUS_META[status]?.tone || 'gray'
  const Icon = status === 'Active' ? CircleCheck : status === 'Under review' ? Clock : null
  return <span className={`br-pill ${tone}`}>{Icon && <Icon size={13} aria-hidden="true" />}{status}</span>
}

function Capacity({ b }) {
  if (!b.capacity) return <p className="br-cap-none">No capacity set</p>
  const pct = Math.min(100, Math.round((b.therapists / b.capacity) * 100))
  return (
    <div className="br-cap">
      <div className="br-cap-text"><span>{b.therapists} of {b.capacity} therapist slots</span><strong>{pct}%</strong></div>
      <div className={`br-cap-bar${pct >= 100 ? ' full' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Owner({ b }) {
  if (!b.owner) return <div className="br-owner none"><span className="br-avatar">?</span><div><strong>No owner assigned</strong></div></div>
  return (
    <div className="br-owner">
      <span className="br-avatar">{initials(b.owner.name || b.owner.email)}</span>
      <div>
        <strong>{b.owner.name || b.owner.email}</strong>
        <small>{b.owner.pending ? `Invited · ${b.owner.email}` : `Branch owner · ${b.owner.email}`}</small>
      </div>
    </div>
  )
}

function BranchCard({ b, menuOpen, onMenu, onView, onEdit, onArchive, onRestore, onReview }) {
  const review = b.status === 'Under review'
  const archived = b.status === 'Archived'
  const tone = STATUS_META[b.status]?.tone || 'gray'
  return (
    <article className={`br-card ${tone}`}>
      <div className="br-cover">
        <StatusPill status={b.status} />
        <div className="br-menu-wrap">
          <button type="button" className="br-icon-btn" aria-label={`Actions for ${b.name}`} aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); onMenu(menuOpen ? null : b.id) }}>
            <EllipsisVertical size={17} />
          </button>
          {menuOpen && (
            <div className="br-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              {!archived && <button type="button" role="menuitem" onClick={() => onEdit(b)}><Pencil size={15} /> Edit</button>}
              {archived
                ? <button type="button" role="menuitem" onClick={() => onRestore(b)}><ArchiveRestore size={15} /> Restore</button>
                : <button type="button" role="menuitem" className="danger" onClick={() => onArchive(b)}><Archive size={15} /> Archive</button>}
            </div>
          )}
        </div>
      </div>
      <span className="br-tile floating"><Building2 size={22} aria-hidden="true" /></span>
      <div className="br-card-body">
        <h3>{b.name}</h3>
        <p className="br-line"><MapPin size={14} aria-hidden="true" /> {b.address || 'No address yet'}</p>
        <p className="br-line"><Phone size={14} aria-hidden="true" /> {b.phone || 'No contact number'}</p>

        <div className="br-metrics">
          <div><strong>{b.therapists}</strong><span>therapists</span></div>
          <div><strong>{b.patients || '—'}</strong><span>patients</span></div>
          <div><strong>{b.sessionsThisMonth || '—'}</strong><span>sessions / mo</span></div>
        </div>

        {review ? (
          <div className="br-callout" role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>{b.missing.length ? `Missing: ${b.missing.join(', ')}. Review the application before activating.` : 'All requirements are in. Ready for your review.'}</span>
          </div>
        ) : b.status === 'Declined' ? (
          <div className="br-callout red" role="status"><X size={16} aria-hidden="true" /><span>Declined: {b.declineReason || 'no reason given'}</span></div>
        ) : b.status === 'Draft' ? (
          <div className="br-callout gray" role="status"><Info size={16} aria-hidden="true" /><span>Draft. Finish the details and submit it for review.</span></div>
        ) : null}
        {review ? (
          <p className="br-submitted">{b.submittedAt ? `Submitted ${fmtDate(b.submittedAt)}` : 'Submitted'}{b.missing.length ? ' · waiting for details' : ''}</p>
        ) : <Capacity b={b} />}
      </div>
      <div className="br-card-foot">
        <Owner b={b} />
        <div className="br-actions">
          {review ? (
            <>
              <button type="button" className="br-btn primary" onClick={() => onReview(b)}><ClipboardCheck size={16} /> Review application</button>
              <button type="button" className="br-btn btn-line" onClick={() => onView(b)}><Eye size={16} /> View</button>
            </>
          ) : (
            <>
              <button type="button" className="br-btn primary" onClick={() => onView(b)}><Eye size={16} /> View branch</button>
              {archived
                ? <button type="button" className="br-btn btn-line" onClick={() => onRestore(b)}><ArchiveRestore size={16} /> Restore</button>
                : <button type="button" className="br-btn btn-line" onClick={() => onEdit(b)}><Pencil size={16} /> {b.status === 'Draft' ? 'Finish' : 'Edit'}</button>}
            </>
          )}
        </div>
      </div>
    </article>
  )
}

function BranchTable({ rows, onView, onEdit, onArchive, onRestore, onReview }) {
  return (
    <div className="br-table-wrap">
      <table className="br-table">
        <thead>
          <tr><th>Branch</th><th>Status</th><th>Location</th><th>Owner</th><th>Therapists</th><th>Patients</th><th>Sessions / mo</th><th><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td data-label="Branch"><strong>{b.name}</strong><small>{b.phone}</small></td>
              <td data-label="Status"><StatusPill status={b.status} /></td>
              <td data-label="Location">{b.address || '—'}</td>
              <td data-label="Owner">{b.owner ? (b.owner.name || b.owner.email) : '—'}</td>
              <td data-label="Therapists">{b.therapists}{b.capacity ? ` / ${b.capacity}` : ''}</td>
              <td data-label="Patients">{b.patients || '—'}</td>
              <td data-label="Sessions / mo">{b.sessionsThisMonth || '—'}</td>
              <td className="br-row-actions">
                <button type="button" className="br-icon-btn" aria-label={`View ${b.name}`} title="View" onClick={() => onView(b)}><Eye size={16} /></button>
                {b.status === 'Under review' && <button type="button" className="br-icon-btn" aria-label={`Review ${b.name}`} title="Review application" onClick={() => onReview(b)}><ClipboardCheck size={16} /></button>}
                {b.status === 'Archived'
                  ? <button type="button" className="br-icon-btn" aria-label={`Restore ${b.name}`} title="Restore" onClick={() => onRestore(b)}><ArchiveRestore size={16} /></button>
                  : (
                    <>
                      <button type="button" className="br-icon-btn" aria-label={`Edit ${b.name}`} title="Edit" onClick={() => onEdit(b)}><Pencil size={16} /></button>
                      <button type="button" className="br-icon-btn danger" aria-label={`Archive ${b.name}`} title="Archive" onClick={() => onArchive(b)}><Archive size={16} /></button>
                    </>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Small shared dialog shell: backdrop click and Esc close it.
function Dialog({ title, icon: Icon, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="br-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`br-modal small${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
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

function ViewDialog({ b, onClose }) {
  return (
    <Dialog title={b.name} icon={Building2} onClose={onClose} wide>
      <div className="br-modal-body">
        <div className="br-detail-top"><StatusPill status={b.status} /></div>
        <dl className="br-detail">
          <div><dt>Address</dt><dd>{b.address || '—'}</dd></div>
          <div><dt>Contact</dt><dd>{b.phone || '—'}</dd></div>
          <div><dt>Email</dt><dd>{b.email || '—'}</dd></div>
          <div><dt>Owner</dt><dd>{b.owner ? `${b.owner.name || b.owner.email}${b.owner.pending ? ' (invited)' : ''}` : 'Not assigned'}</dd></div>
          <div><dt>Therapists</dt><dd>{b.therapists}{b.capacity ? ` of ${b.capacity} slots` : ''}</dd></div>
          <div><dt>Patients</dt><dd>{b.patients}</dd></div>
          <div><dt>Sessions this month</dt><dd>{b.sessionsThisMonth}</dd></div>
          <div><dt>Services</dt><dd>{b.services.length ? b.services.join(', ') : '—'}</dd></div>
        </dl>
        <p className="br-eyebrow">Operating hours</p>
        {b.hours ? (
          <ul className="br-hours-view">
            {DAYS.map((d) => (
              <li key={d.key}><span>{d.label}</span><span>{b.hours[d.key]?.open ? `${b.hours[d.key].from} – ${b.hours[d.key].to}` : 'Closed'}</span></li>
            ))}
          </ul>
        ) : <p className="br-hint">No hours set.</p>}
        {b.declineReason && b.status === 'Declined' && <p className="br-callout red"><X size={16} /> Declined: {b.declineReason}</p>}
      </div>
      <footer className="br-modal-foot"><span className="br-spacer" /><button type="button" className="br-btn btn-line" onClick={onClose}>Close</button></footer>
    </Dialog>
  )
}

function ReviewDialog({ b, onClose, onDone, run }) {
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const act = async (body) => {
    setBusy(true); setError('')
    try { await run(b, body); onDone(body.action) } catch (err) { setError(err.fields?.reason || err.message); setBusy(false) }
  }
  return (
    <Dialog title="Review application" icon={ClipboardCheck} onClose={onClose}>
      <div className="br-modal-body">
        <p className="br-review-name">{b.name}</p>
        <p className="br-hint">{b.address || 'No address'}{b.submittedAt ? ` · Submitted ${fmtDate(b.submittedAt)}` : ''}</p>
        {b.missing.length ? (
          <div className="br-callout"><TriangleAlert size={16} /><span>Missing requirements: {b.missing.join(', ')}. Approving is blocked until these are filled in (use Edit).</span></div>
        ) : (
          <div className="br-callout ok"><CircleCheck size={16} /><span>All requirements are in place.</span></div>
        )}
        {declining && (
          <div className="br-field" style={{ marginTop: 14 }}>
            <div className="br-field-head"><label htmlFor="br-reason">Reason for declining</label></div>
            <textarea id="br-reason" className="br-textarea" rows={3} value={reason} maxLength={500} autoFocus onChange={(e) => { setReason(e.target.value); setError('') }} placeholder="Tell the applicant what needs to change." />
          </div>
        )}
        {error && <p className="br-form-error" role="alert">{error}</p>}
      </div>
      <footer className="br-modal-foot">
        <span className="br-spacer" />
        {declining ? (
          <>
            <button type="button" className="br-btn btn-line" onClick={() => { setDeclining(false); setError('') }} disabled={busy}>Back</button>
            <button type="button" className="br-btn danger" onClick={() => act({ action: 'decline', reason })} disabled={busy}>Decline application</button>
          </>
        ) : (
          <>
            <button type="button" className="br-btn btn-line" onClick={() => setDeclining(true)} disabled={busy}>Decline</button>
            <button type="button" className="br-btn primary" onClick={() => act({ action: 'approve' })} disabled={busy || b.missing.length > 0}>Approve and activate</button>
          </>
        )}
      </footer>
    </Dialog>
  )
}

function ArchiveDialog({ b, restore, onClose, run, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    setBusy(true); setError('')
    try { await run(b, { action: restore ? 'restore' : 'archive' }); onDone(restore ? 'restored' : 'archived') } catch (err) { setError(err.message); setBusy(false) }
  }
  return (
    <Dialog title={restore ? 'Restore branch?' : 'Archive branch?'} icon={restore ? ArchiveRestore : Archive} onClose={onClose}>
      <div className="br-modal-body">
        <p>{restore
          ? `${b.name} will return to the list with its previous status.`
          : `${b.name} will move to Archived. Its patient records and history are kept, and you can restore it later.`}</p>
        {error && <p className="br-form-error" role="alert">{error}</p>}
      </div>
      <footer className="br-modal-foot">
        <span className="br-spacer" />
        <button type="button" className="br-btn btn-line" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`br-btn ${restore ? 'primary' : 'danger'}`} onClick={go} disabled={busy}>{restore ? 'Restore' : 'Archive'}</button>
      </footer>
    </Dialog>
  )
}

export default function BranchesPage({ user, onLogout }) {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('status')) ? params.get('status') : 'all'
  const q = params.get('q') || ''
  const region = params.get('region') || ''
  const sort = SORTS.some((s) => s.key === params.get('sort')) ? params.get('sort') : 'therapists'
  const view = params.get('view') === 'list' ? 'list' : 'grid'

  const setParam = useCallback((key, value, fallback = '') => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!value || value === fallback) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }, [setParams])

  const [branches, setBranches] = useState([])
  const [therapistsThisMonth, setTherapistsThisMonth] = useState(0)
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState('')
  const [menuId, setMenuId] = useState(null)
  const [dialog, setDialog] = useState(null) // { type: 'form'|'view'|'review'|'archive'|'restore', branch? }
  const toastTimer = useRef(null)

  const flash = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [list, ownerRes] = await Promise.all([
        authFetch('/api/admin/branches'),
        authFetch('/api/admin/branch-owners').catch(() => ({ owners: [] })),
      ])
      setBranches(list.branches)
      setTherapistsThisMonth(list.therapistsThisMonth || 0)
      setOwners(ownerRes.owners)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
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

  // Archive / restore / approve / decline all go through the same PATCH.
  const runAction = useCallback(async (b, body) => {
    const data = await authFetch(`/api/admin/branches/${b.id}`, { method: 'PATCH', body })
    setBranches((cur) => cur.map((x) => (x.id === b.id ? data.branch : x)))
  }, [])

  const live = useMemo(() => branches.filter((b) => b.status !== 'Archived'), [branches])
  const regions = useMemo(() => [...new Set(branches.map((b) => b.province).filter(Boolean))].sort(), [branches])
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, branches.filter((b) => matchesTab(b, t.key)).length])), [branches])
  const stats = useMemo(() => ({
    total: live.length,
    regions: new Set(live.map((b) => b.province).filter(Boolean)).size,
    active: live.filter((b) => b.status === 'Active').length,
    review: live.filter((b) => b.status === 'Under review').length,
    therapists: live.reduce((n, b) => n + b.therapists, 0),
  }), [live])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = branches.filter((b) => {
      if (!matchesTab(b, tab)) return false
      if (region && b.province !== region) return false
      if (!needle) return true
      return [b.name, b.city, b.province, b.owner?.name, b.owner?.email].some((v) => v && v.toLowerCase().includes(needle))
    })
    const by = {
      therapists: (a, c) => c.therapists - a.therapists || a.name.localeCompare(c.name),
      newest: (a, c) => new Date(c.createdAt || 0) - new Date(a.createdAt || 0),
      az: (a, c) => a.name.localeCompare(c.name),
    }
    return rows.sort(by[sort])
  }, [branches, tab, region, q, sort])

  const open = (type, branch) => { setMenuId(null); setDialog({ type, branch }) }
  const close = useCallback(() => setDialog(null), [])

  const onSaved = (saved, kind) => {
    setBranches((cur) => (cur.some((x) => x.id === saved.id) ? cur.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...cur]))
    setDialog(null)
    flash(kind === 'draft' ? 'Draft saved.' : kind === 'updated' ? 'Branch updated.' : 'Branch created.')
    load()
  }
  const onActionDone = (kind) => {
    setDialog(null)
    flash({ archived: 'Branch archived.', restored: 'Branch restored.', approve: 'Branch approved and now Active.', decline: 'Application declined.' }[kind] || 'Done.')
    load()
  }

  const handlers = {
    onView: (b) => open('view', b),
    onEdit: (b) => open('form', b),
    onArchive: (b) => open('archive', b),
    onRestore: (b) => open('restore', b),
    onReview: (b) => open('review', b),
  }

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="Branches" subtitle="Clinic locations, their owners and therapists" icon="" menuItems={adminMenuItems}>
      <div className="br-page">
        <div className="br-toprow">
          <button type="button" className="br-btn primary" onClick={() => open('form', null)}><Plus size={17} /> Add branch</button>
        </div>

        <section className="br-stats" aria-label="Branch summary">
          <div className="br-stat">
            <span className="br-tile blue"><Building2 size={22} aria-hidden="true" /></span>
            <div><strong>{stats.total}</strong><span>Total branches</span><em>Across {stats.regions} region{stats.regions === 1 ? '' : 's'}</em></div>
          </div>
          <div className="br-stat">
            <span className="br-tile green"><CircleCheck size={22} aria-hidden="true" /></span>
            <div><strong>{stats.active}</strong><span>Active</span><em>Currently operating</em></div>
          </div>
          <div className={`br-stat amber${stats.review ? ' hot' : ''}`}>
            <span className="br-tile yellow"><Clock size={22} aria-hidden="true" /></span>
            <div><strong>{stats.review}</strong><span>Under review</span></div>
            {stats.review > 0 && <button type="button" className="br-link" onClick={() => setParam('status', 'review', 'all')}>Review</button>}
          </div>
          <div className="br-stat">
            <span className="br-tile purple"><Stethoscope size={22} aria-hidden="true" /></span>
            <div><strong>{stats.therapists}</strong><span>Therapists assigned</span><em>+{therapistsThisMonth} this month</em></div>
          </div>
        </section>

        <section className="br-filters" aria-label="Filters">
          <div className="br-tabs" role="tablist" aria-label="Status">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setParam('status', t.key, 'all')}>
                {t.label} <span className="br-count">{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="br-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search branch, city or owner…" aria-label="Search branches" />
          </label>
          <label className="br-select">
            <MapIcon size={15} aria-hidden="true" /><span>Region</span>
            <select value={region} onChange={(e) => setParam('region', e.target.value)} aria-label="Region">
              <option value="">All</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          <label className="br-select">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value, 'therapists')} aria-label="Sort by">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          <div className="br-toggle" role="group" aria-label="Layout">
            <button type="button" className={view === 'grid' ? 'on' : ''} aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setParam('view', 'grid', 'grid')}><LayoutGrid size={16} /></button>
            <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} aria-label="List view" onClick={() => setParam('view', 'list', 'grid')}><List size={16} /></button>
          </div>
        </section>

        {loading ? (
          <p className="br-empty">Loading branches…</p>
        ) : loadError ? (
          <div className="br-empty"><p>{loadError}</p><button type="button" className="br-btn btn-line" onClick={() => { setLoading(true); load() }}>Try again</button></div>
        ) : visible.length === 0 ? (
          <div className="br-empty">
            <Building2 size={28} aria-hidden="true" />
            <p>{branches.length ? 'No branches match these filters.' : 'No branches yet.'}</p>
            {branches.length === 0 && <button type="button" className="br-btn primary" onClick={() => open('form', null)}><Plus size={16} /> Add branch</button>}
          </div>
        ) : view === 'grid' ? (
          <div className="br-grid">
            {visible.map((b) => <BranchCard key={b.id} b={b} menuOpen={menuId === b.id} onMenu={setMenuId} {...handlers} />)}
          </div>
        ) : (
          <BranchTable rows={visible} {...handlers} />
        )}

        <p className="br-footnote"><Info size={14} aria-hidden="true" /> Archived branches keep their patient records and history. Only the Super Admin can add, edit or archive branches.</p>
      </div>

      {dialog?.type === 'form' && (
        <AddBranchModal branch={dialog.branch} owners={owners} existingBranches={branches} onClose={close} onSaved={onSaved} />
      )}
      {dialog?.type === 'view' && <ViewDialog b={dialog.branch} onClose={close} />}
      {dialog?.type === 'review' && <ReviewDialog b={dialog.branch} onClose={close} onDone={onActionDone} run={runAction} />}
      {(dialog?.type === 'archive' || dialog?.type === 'restore') && (
        <ArchiveDialog b={dialog.branch} restore={dialog.type === 'restore'} onClose={close} run={runAction} onDone={onActionDone} />
      )}
      {toast && <div className="br-toast" role="status"><CircleCheck size={16} /> {toast}</div>}
    </AdminPageShell>
  )
}
