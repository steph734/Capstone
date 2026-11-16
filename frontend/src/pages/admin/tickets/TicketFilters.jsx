import { useEffect, useState } from 'react'
import { CATEGORY_LABEL, PRIORITY_META, SORT_LABEL, STATUS_META } from './ticketConfig'

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_on_user', 'resolved']
const ROLE_OPTIONS = [['owner', 'Owner'], ['therapist', 'Therapist'], ['guardian', 'Guardian']]

// Tabs (with counts that follow the current search and filters), debounced search, dropdown filters and sort.
// Everything lives in the URL query string; `params` is a URLSearchParams and `onChange` patches it.
export default function TicketFilters({ params, counts, onChange, onClear }) {
  const tab = params.get('tab') || ''
  const [q, setQ] = useState(params.get('q') || '')
  const urlQ = params.get('q') || ''
  useEffect(() => { setQ(urlQ) }, [urlQ])
  useEffect(() => {
    if (q === urlQ) return undefined
    const t = setTimeout(() => onChange({ q }), 300)
    return () => clearTimeout(t)
  }, [q, urlQ, onChange])

  const active = ['q', 'status', 'category', 'priority', 'role'].some((k) => params.get(k)) || ['owner_request', 'concern'].includes(tab)
  const tabs = [['', 'All', counts?.all], ['owner_request', 'Owner requests', counts?.owner_request], ['concern', 'Concerns', counts?.concern]]
  const select = (key, label, options) => (
    <select aria-label={label} value={params.get(key) || ''} onChange={(e) => onChange({ [key]: e.target.value })}>
      <option value="">{label.startsWith('All') ? label : `All ${label.toLowerCase()}`}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )

  return (
    <div className="tk-filters">
      <div className="tk-filters-row">
        <div className="tk-tabs" role="tablist" aria-label="Ticket type">
          {tabs.map(([id, label, n]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onChange({ tab: id })}>
              {label} <span>{n ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="tk-search">
          <span aria-hidden="true">🔍</span>
          <input type="search" value={q} placeholder="Search subject or TCK-…" aria-label="Search subject or ticket number" onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="tk-filters-row">
        {select('status', 'All statuses', STATUS_OPTIONS.map((s) => [s, STATUS_META[s].label]))}
        {select('category', 'All categories', Object.entries(CATEGORY_LABEL))}
        {select('priority', 'All priorities', Object.entries(PRIORITY_META).map(([k, v]) => [k, v.label]))}
        {select('role', 'All roles', ROLE_OPTIONS)}
        {active && <button type="button" className="tk-link" onClick={onClear}>Clear filters</button>}
        <label className="tk-sort">
          <span className="tk-sr">Sort</span>
          <select aria-label="Sort" value={params.get('sort') || 'oldest'} onChange={(e) => onChange({ sort: e.target.value === 'oldest' ? '' : e.target.value })}>
            {Object.entries(SORT_LABEL).map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
