import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Users, UserCheck, CalendarCheck, Clock, Search, Plus, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { patientsApi } from './patients/api'
import { fmtDay } from './patients/format'
import { Avatar, StatusBadge, useToast } from './patients/ui'
import MoreActionsMenu from './patients/MoreActionsMenu'
import PatientDetailModal from './patients/PatientDetailModal'
import { ArchiveModal, DeleteModal } from './patients/ArchiveDeleteModals'
import AddPatientModal from './patients/AddPatientModal'
import MessageGuardianModal from './patients/MessageGuardianModal'
import './patients/PatientsPage.css'

const PAGE_SIZE = 10
const SEGMENTS = [['all', 'All', 'total'], ['active', 'Active', 'active'], ['inactive', 'Inactive', 'inactive'], ['archived', 'Archived', 'archived']]
const SORTS = [['name', 'name'], ['name_desc', 'name (Z–A)'], ['newest', 'newest added'], ['last_session', 'last session'], ['next_session', 'next session']]

function StatCard({ icon: I, tone, value, label, children, onClick, active }) {
  const body = (
    <>
      <span className={`pm-stat-ico ${tone}`} aria-hidden="true"><I size={20} /></span>
      <span className="pm-stat-text"><strong>{value}</strong><span>{label}</span></span>
    </>
  )
  // The clickable card is a div holding two real buttons (filter + link), never a button inside a button.
  return onClick
    ? <div className={`pm-stat clickable${active ? ' active' : ''}`}><button type="button" className="pm-stat-main" onClick={onClick} aria-pressed={active}>{body}</button>{children}</div>
    : <div className="pm-stat">{body}</div>
}

export default function TherapistPatientsPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Filters, sort and page live in the URL, so a refresh or a shared link keeps the same view.
  const status = SEGMENTS.some(([k]) => k === params.get('status')) ? params.get('status') : 'all'
  const sort = SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : 'name'
  const needs = params.get('needs') === '1'
  const isDay = (v) => /^d{4}-d{2}-d{2}$/.test(v || '')
  const dFrom = isDay(params.get('from')) ? params.get('from') : ''
  const dTo = isDay(params.get('to')) ? params.get('to') : ''
  const page = Math.max(1, parseInt(params.get('page'), 10) || 1)
  const urlSearch = params.get('q') || ''

  const [searchText, setSearchText] = useState(urlSearch)
  const [data, setData] = useState(null) // { items, total, page, counts, fee, therapist }
  const [state, setState] = useState({ loading: true, error: '' })
  const [view, setView] = useState(null) // detail modal: { id, summary }
  const [archiveFor, setArchiveFor] = useState(null)
  const [deleteFor, setDeleteFor] = useState(null)
  const [messageFor, setMessageFor] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toastEl, toast] = useToast()
  const reqId = useRef(0)

  const setParam = useCallback((patch) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) { if (v === '' || v == null || v === false) n.delete(k); else n.set(k, String(v)) }
    return n
  }, { replace: true }), [setParams])

  // Search is debounced (300 ms) into the URL.
  useEffect(() => {
    if (searchText === urlSearch) return undefined
    const t = setTimeout(() => setParam({ q: searchText.trim(), page: '' }), 300)
    return () => clearTimeout(t)
  }, [searchText]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSearchText(urlSearch) }, [urlSearch])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const d = await patientsApi.list({ search: urlSearch, status, needs_session: needs ? '1' : '', from: dFrom, to: dTo, sort, page, limit: PAGE_SIZE })
      if (id === reqId.current) { setData(d); setState({ loading: false, error: '' }) }
    } catch (e) {
      if (id === reqId.current) setState({ loading: false, error: e.message || 'Could not load your patients.' })
    }
  }, [urlSearch, status, needs, sort, page, dFrom, dTo])
  useEffect(() => { load() }, [load])

  const counts = data?.counts || { total: 0, active: 0, inactive: 0, archived: 0, upcoming_booked: 0, need_session: 0 }
  const items = data?.items || []
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE))
  const filtered = Boolean(urlSearch || needs || dFrom || dTo || status !== 'all')
  const from = data?.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const to = Math.min(page * PAGE_SIZE, data?.total || 0)

  const bookSession = (p) => navigate('/therapist/appointments', { state: { patientId: p.id, patientName: p.name } })
  const unarchive = async (p) => {
    try { await patientsApi.unarchive(p.id); toast(`${p.name} unarchived`); load() } catch (e) { toast(e.message) }
  }
  const pageNumbers = useMemo(() => {
    const out = []
    for (let i = 1; i <= totalPages; i += 1) if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) out.push(i)
    return out.reduce((acc, n, i) => (i && n - out[i - 1] > 1 ? [...acc, '…', n] : [...acc, n]), [])
  }, [totalPages, page])

  const empty = !state.loading && !state.error && items.length === 0
  const noPatientsAtAll = empty && !filtered && counts.total + counts.archived === 0

  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="My Patients" subtitle="Track your assigned patients and current progress" icon="" menuItems={getTherapistMenuItems(betaTier)}>
      <div className="pm-page">
        <div className="pm-stats">
          <StatCard icon={Users} tone="violet" value={counts.total} label="Total patients" />
          <StatCard icon={UserCheck} tone="green" value={counts.active} label="Active" />
          <StatCard icon={CalendarCheck} tone="blue" value={counts.upcoming_booked} label="Upcoming booked" />
          <StatCard icon={Clock} tone="amber" value={counts.need_session} label="Need a session" onClick={() => setParam({ needs: needs ? '' : '1', status: '', page: '' })} active={needs}>
            <button type="button" className="pm-stat-link" onClick={() => navigate('/therapist/appointments')}>Book <ChevronRight size={13} aria-hidden="true" /></button>
          </StatCard>
        </div>

        <div className="pm-toolbar">
          <label className="pm-search"><Search size={16} aria-hidden="true" /><span className="pm-sr">Search patients</span>
            <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search patients…" />
          </label>
          <div className="pm-seg" role="group" aria-label="Filter by status">
            {SEGMENTS.map(([key, label, ck]) => (
              <button key={key} type="button" className={status === key && !needs ? 'on' : ''} aria-pressed={status === key && !needs} onClick={() => setParam({ status: key === 'all' ? '' : key, needs: '', page: '' })}>
                {label} <span>{counts[ck]}</span>
              </button>
            ))}
          </div>
          <label className="pm-sort">Sort by <select value={sort} onChange={(e) => setParam({ sort: e.target.value === 'name' ? '' : e.target.value, page: '' })} aria-label="Sort patients">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div className="pm-datef" role="group" aria-label="Filter by session date">
            <label>Session from <input type="date" value={dFrom} max={dTo || undefined} onChange={(e) => setParam({ from: e.target.value, page: '' })} /></label>
            <label>to <input type="date" value={dTo} min={dFrom || undefined} onChange={(e) => setParam({ to: e.target.value, page: '' })} /></label>
            {(dFrom || dTo) && <button type="button" className="pm-inline-link" onClick={() => setParam({ from: '', to: '', page: '' })}>Clear dates</button>}
          </div>
          <button type="button" className="pm-btn primary" onClick={() => setAddOpen(true)} disabled={!data}><Plus size={16} aria-hidden="true" /> Add patient</button>
        </div>
        {needs && <p className="pm-filter-note">Showing active patients with no upcoming session. <button type="button" className="pm-inline-link" onClick={() => setParam({ needs: '' })}>Clear</button></p>}

        <section className="pm-table-card" aria-busy={state.loading}>
          {state.error ? (
            <div className="pm-state"><AlertTriangle size={26} aria-hidden="true" /><p>{state.error}</p><button type="button" className="pm-btn light" onClick={load}><RefreshCw size={15} aria-hidden="true" /> Retry</button></div>
          ) : state.loading && !data ? (
            <div className="pm-skeleton" aria-label="Loading patients">{[0, 1, 2, 3].map((i) => <div key={i} className="pm-skel-row" />)}</div>
          ) : noPatientsAtAll ? (
            <div className="pm-state"><UserPlus size={28} aria-hidden="true" /><p><strong>No patients yet</strong>Add your first patient to start tracking sessions and progress.</p><button type="button" className="pm-btn primary" onClick={() => setAddOpen(true)}><Plus size={16} aria-hidden="true" /> Add your first patient</button></div>
          ) : empty ? (
            <div className="pm-state"><Search size={26} aria-hidden="true" /><p><strong>{status === 'archived' && !urlSearch ? 'No archived patients' : 'No patients match'}</strong>{status === 'archived' && !urlSearch ? 'Archived patients appear here and can be unarchived any time.' : 'Try a different search or filter.'}</p>{filtered && <button type="button" className="pm-btn light" onClick={() => { setSearchText(''); setParams({}, { replace: true }) }}>Clear filters</button>}</div>
          ) : (
            <>
              <table className="pm-table">
                <thead><tr><th scope="col">Patient</th><th scope="col">Last session</th><th scope="col">Next session</th><th scope="col" className="num">Sessions</th><th scope="col"><span className="pm-sr">Actions</span></th></tr></thead>
                <tbody className={state.loading ? 'loading' : ''}>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Patient">
                        <div className="pm-who">
                          <Avatar id={p.id} name={p.name} photoUrl={p.photoUrl} />
                          <div><div className="pm-name">{p.name} <StatusBadge status={p.status} /></div><div className="pm-sub">{[p.age != null && `Age ${p.age}`, p.condition].filter(Boolean).join(' · ')}</div></div>
                        </div>
                      </td>
                      <td data-label="Last session">{fmtDay(p.lastSession) || <span className="pm-muted">None yet</span>}</td>
                      <td data-label="Next session">{p.nextSession ? fmtDay(p.nextSession) : <span className="pm-pill amber">Not booked</span>}</td>
                      <td data-label="Sessions" className="num">{p.sessions}</td>
                      <td className="act">
                        <button type="button" className="pm-btn primary sm" onClick={() => setView({ id: p.id, summary: p })}>View</button>
                        <MoreActionsMenu patient={p} onBook={bookSession} onMessage={setMessageFor} onArchive={setArchiveFor} onUnarchive={unarchive} onDelete={setDeleteFor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pm-pager">
                <span>Showing {from}–{to} of {data.total} patient{data.total === 1 ? '' : 's'}</span>
                {totalPages > 1 && (
                  <nav aria-label="Pagination">
                    <button type="button" className="pm-page-btn" disabled={page <= 1} onClick={() => setParam({ page: page - 1 })}><ChevronLeft size={15} aria-hidden="true" /> Prev</button>
                    {pageNumbers.map((n, i) => (n === '…' ? <span key={`g${i}`} className="pm-gap">…</span> : <button key={n} type="button" className={`pm-page-btn num${n === page ? ' on' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => setParam({ page: n })}>{n}</button>))}
                    <button type="button" className="pm-page-btn" disabled={page >= totalPages} onClick={() => setParam({ page: page + 1 })}>Next <ChevronRight size={15} aria-hidden="true" /></button>
                  </nav>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {view && <PatientDetailModal id={view.id} summary={view.summary} onClose={() => setView(null)} onBook={bookSession} onMessage={(p) => { setView(null); setMessageFor(p) }} flash={toast} />}
      {messageFor && <MessageGuardianModal patient={messageFor} therapistEmail={user?.email} onClose={() => setMessageFor(null)} />}
      {archiveFor && (
        <ArchiveModal patient={archiveFor} onClose={() => setArchiveFor(null)} onArchived={(p) => {
          setArchiveFor(null); load()
          toast(`${p.name} archived.`, { label: 'Undo', run: () => patientsApi.unarchive(p.id).then(load).catch((e) => toast(e.message)) })
        }} />
      )}
      {deleteFor && (
        <DeleteModal patient={deleteFor} onClose={() => setDeleteFor(null)} onArchiveInstead={() => { const p = deleteFor; setDeleteFor(null); setArchiveFor(p) }} onDeleted={(p) => { setDeleteFor(null); load(); toast(`${p.name} was permanently deleted.`) }} />
      )}
      {addOpen && (
        <AddPatientModal
          fee={data?.fee} therapist={data?.therapist}
          onClose={() => { setAddOpen(false); load() }}
          onCreated={() => load()}
          onOpenExisting={(id) => setView({ id, summary: null })}
          onBookFirst={(p) => navigate('/therapist/appointments', { state: { patientId: p.id, patientName: p.name } })}
        />
      )}
      {toastEl}
    </TherapistPageShell>
  )
}
