import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { presetRange, today, fmtRangeShort } from '../reports/reportRange'
import { call } from './financeApi'

/* ── Tabs: Revenue | Invoices | Expenses | Payouts | How you get paid ── */
const TABS = [
  { label: 'Revenue', path: '/owner/billing' },
  { label: 'Invoices', path: '/owner/billing/invoices' },
  { label: 'Expenses', path: '/owner/billing/expenses' },
  { label: 'Payouts', path: '/owner/billing/payouts' },
  { label: 'How you get paid', path: '/owner/billing/settings' },
]
export function BillingTabs({ action }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  return (
    <nav className="fin-tabs" aria-label="Sales and billing sections">
      {TABS.map((t) => (
        <button key={t.path} type="button" className={`fin-tab ${pathname === t.path ? 'active' : ''}`} aria-current={pathname === t.path ? 'page' : undefined} onClick={() => nav(t.path)}>{t.label}</button>
      ))}
      {action && <div className="fin-tabaction">{action}</div>}
    </nav>
  )
}

/* ── Modal: focus trapped, Esc closes (asks first when there are unsaved changes) ── */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
export function Modal({ title, subtitle, titleSuffix, onClose, dirty = false, footer, children, wide = true, topbar }) {
  const ref = useRef(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const titleId = useId()
  const requestClose = useCallback(() => { if (dirty) setConfirmClose(true); else onClose() }, [dirty, onClose])
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector('[data-autofocus]')?.focus() || ref.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; opener?.focus?.() }
  }, [])
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); requestClose(); return }
    if (e.key !== 'Tab') return
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
    if (!items.length) return
    const first = items[0]; const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  return (
    <div className="fin-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className={`fin-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref} onKeyDown={onKey}>
        <header className="fin-modal-head">
          <div>
            <h2 id={titleId}>{title}{titleSuffix && <span className="fin-title-suffix"> · {titleSuffix}</span>}</h2>
            {subtitle && <p>{subtitle}</p>}
            {topbar}
          </div>
          <button type="button" className="fin-x" onClick={requestClose} aria-label="Close">✕</button>
        </header>
        <div className="fin-modal-body">{children}</div>
        {footer && <footer className="fin-modal-foot">{footer}</footer>}
        {confirmClose && (
          <div className="fin-confirm" role="alertdialog" aria-label="Discard changes?">
            <div className="fin-confirm-box">
              <strong>Discard your changes?</strong>
              <p>What you entered has not been saved.</p>
              <div className="fin-row-end">
                <button type="button" className="fin-btn" onClick={() => setConfirmClose(false)} data-autofocus>Keep editing</button>
                <button type="button" className="fin-btn fin-btn-danger" onClick={onClose}>Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Form pieces ── */
export function Field({ label, required, error, hint, children, className = '', htmlFor }) {
  const id = useId()
  return (
    <div className={`fin-field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={htmlFor || id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {typeof children === 'function' ? children(htmlFor || id, error ? `${id}-err` : undefined) : children}
      {hint && !error && <small className="fin-hint">{hint}</small>}
      {error && <small className="fin-err" id={`${id}-err`} role="alert">{error}</small>}
    </div>
  )
}
export const Text = ({ id, errId, invalid, ...p }) => <input id={id} aria-invalid={invalid || undefined} aria-describedby={errId} {...p} />
export function Section({ n, title, children, aside }) {
  return (
    <section className="fin-section">
      <div className="fin-section-head"><span className="fin-n" aria-hidden="true">{n}</span><h3>{title}</h3>{aside}</div>
      {children}
    </section>
  )
}
export function Chips({ label, value, options, onChange }) {
  return (
    <div className="fin-chipsrow" role="radiogroup" aria-label={label}>
      <span className="fin-kicker">{label}</span>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const l = typeof o === 'string' ? o : o.label
        return <button key={v} type="button" role="radio" aria-checked={value === v} className={`fin-chip ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>{l}</button>
      })}
    </div>
  )
}
export function Toggle({ checked, onChange, children }) {
  return (
    <label className="fin-toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="fin-switch" aria-hidden="true" />
      <span>{children}</span>
    </label>
  )
}
export const ErrorBanner = ({ children }) => (children ? <div className="fin-banner" role="alert">{children}</div> : null)
export const Skeleton = ({ rows = 5 }) => (
  <div className="fin-skel" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="fin-skel-row" />)}</div>
)
export function StatusPill({ status }) {
  const label = status
  return <span className={`fin-pill ${status.toLowerCase()}`}><span className="fin-dot" aria-hidden="true" />{label}</span>
}
export function useToast() {
  const [toast, setToast] = useState(null)
  const t = useRef(null)
  const show = useCallback((msg, kind = 'ok') => { setToast({ msg, kind }); clearTimeout(t.current); t.current = setTimeout(() => setToast(null), 4000) }, [])
  useEffect(() => () => clearTimeout(t.current), [])
  return [toast ? <div className={`fin-toast ${toast.kind}`} role="status">{toast.msg}</div> : null, show]
}
export function Pager({ page, pages, total, onPage }) {
  if (pages <= 1) return <div className="fin-pager"><span>{total} record{total === 1 ? '' : 's'}</span></div>
  return (
    <div className="fin-pager">
      <span>{total} records</span>
      <button type="button" className="fin-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span aria-live="polite">Page {page} of {pages}</span>
      <button type="button" className="fin-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  )
}

/* ── Row ⋮ menu ── */
export function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  return (
    <div className="fin-menuwrap" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <button type="button" className="fin-kebab" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>⋮</button>
      {open && (
        <div className="fin-menu" role="menu">
          {items.filter(Boolean).map((it) => <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick() }}>{it.label}</button>)}
        </div>
      )}
    </div>
  )
}

/* ── Date range filter: presets + custom range, inclusive days in Manila ── */
const MENU_PRESETS = [['today', 'Today'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days'], ['thisMonth', 'This month'], ['lastMonth', 'Last month']]
export function DateRangeMenu({ label, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [from, setFrom] = useState(value.from || '')
  const [to, setTo] = useState(value.to || '')
  const ref = useRef(null)
  const now = today()
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  const apply = (r) => { onChange(r); setOpen(false); setCustom(false) }
  const bad = custom && from && to && from > to
  const active = value.from || value.to
  return (
    <div className="fin-menuwrap" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <button type="button" className={`fin-filterbtn ${active ? 'on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">📅</span> {label} <strong>{active ? fmtRangeShort(value.from || '', value.to || '') || `${value.from || '…'} – ${value.to || '…'}` : 'All'}</strong> <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="fin-menu wide" role="dialog" aria-label={`${label} filter`}>
          {MENU_PRESETS.map(([k, l]) => <button key={k} type="button" onClick={() => apply(presetRange(k, now))}>{l}</button>)}
          <button type="button" onClick={() => setCustom(true)}>Custom range…</button>
          {custom && (
            <div className="fin-customrange">
              <label>From<input type="date" value={from} max={now} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              {bad && <small className="fin-err" role="alert">Start must not be after the end.</small>}
              <button type="button" className="fin-btn fin-btn-primary" disabled={bad || (!from && !to)} onClick={() => apply({ from, to })}>Apply</button>
            </div>
          )}
          {active && <button type="button" className="danger" onClick={() => apply({ from: '', to: '' })}>Clear</button>}
        </div>
      )}
    </div>
  )
}

/* ── Vendor combobox: searchable, filtered by type, with "Add new vendor" ── */
export function VendorSelect({ label, required, value, vendorId, onPick, filter, error, newVendorType, newUtilityType, onError }) {
  const [text, setText] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [list, setList] = useState([])
  const [busy, setBusy] = useState(false)
  const listId = useId()
  const key = JSON.stringify(filter || {})
  useEffect(() => { setText(value || '') }, [value])
  useEffect(() => {
    let live = true
    call('vendors', { query: { ...filter, q: text && text !== value ? text : undefined } }).then((d) => { if (live) setList(d.vendors) }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, text, value])
  const exact = list.some((v) => v.vendor_name.toLowerCase() === text.trim().toLowerCase())
  const addNew = async () => {
    setBusy(true)
    try {
      const v = await call('vendors', { method: 'POST', body: { vendor_name: text.trim(), vendor_type: newVendorType, ...(newVendorType === 'Utility' ? { utility_type: newUtilityType } : {}) } })
      onPick(v.vendor); setOpen(false)
    } catch (e) { onError?.(e.fields?.vendor_name || e.message) } finally { setBusy(false) }
  }
  return (
    <Field label={label} required={required} error={error}>
      {(id, errId) => (
        <div className="fin-combo">
          <input id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-invalid={!!error || undefined} aria-describedby={errId} autoComplete="off"
            value={text} placeholder="Search or type…"
            onChange={(e) => { setText(e.target.value); setOpen(true); if (vendorId) onPick({ id: null, vendor_name: e.target.value }) ; else onPick({ id: null, vendor_name: e.target.value }) }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
          {open && (
            <ul className="fin-listbox" id={listId} role="listbox">
              {list.map((v) => <li key={v.id} role="option" aria-selected={v.id === vendorId}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(v); setText(v.vendor_name); setOpen(false) }}>{v.vendor_name}</button></li>)}
              {text.trim() && !exact && newVendorType && <li role="option"><button type="button" className="add" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={addNew}>+ Add new vendor “{text.trim()}”</button></li>}
              {!list.length && !text.trim() && <li className="fin-listempty">No vendors yet. Type a name to add one.</li>}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}
