import { useEffect, useMemo, useRef, useState } from 'react'
import { call, errMsg } from './financeApi'

// "Clinic details on invoices": VIEW ONLY for the Owner. The Super Admin sets these on the Branches page. Nothing here is an
// input: values are plain text (role="textbox" + aria-readonly) so they can be read, selected and copied, never edited.
const NOT_PROVIDED = <em className="fin-notprovided">Not provided</em>

function Lock() {
  return (
    <svg className="fin-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
  )
}
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
)

// One read-only value with a lock.
function ROField({ label, value, multiline, tone, className = '', children }) {
  return (
    <div className={`fin-rofield ${className}`}>
      <span className="fin-rolabel">{label}</span>
      <div className={`fin-rovalue ${multiline ? 'multi' : ''} ${tone || ''}`} role="textbox" aria-readonly="true" aria-multiline={multiline || undefined} aria-label={label} tabIndex={0}>
        <span className="fin-rotext">{value ? value : (children || NOT_PROVIDED)}</span>
        <Lock />
      </div>
    </div>
  )
}

const statusLabel = (s) => s || 'Active'

// The branch picker: each option shows the branch, its address, and its TIN or an amber "No TIN yet" tag; a check marks the
// selected one. Keyboard: Enter/Space/Arrow opens, arrows move, Enter chooses, Esc closes.
export function BranchPicker({ branches, branch, onPick }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  const openList = () => { setCursor(Math.max(0, branches.findIndex((b) => b.id === branch.id))); setOpen(true) }
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(branches.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(branches[cursor].id); setOpen(false) }
  }
  return (
    <div className="fin-picker" ref={ref}>
      <button type="button" className="fin-pickerbtn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="fin-branch-list" aria-label="Branch" onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}>
        <span aria-hidden="true">🏢</span>
        <strong>{branch.name}</strong>
        <span className={`fin-status ${(branch.status || '').toLowerCase().replace(/\s+/g, '-')}`}><span className="fin-dot" aria-hidden="true" />{statusLabel(branch.status)}</span>
        <span className="fin-chev" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <ul className="fin-pickerlist" id="fin-branch-list" role="listbox" aria-label="Branches">
          {branches.map((b, i) => (
            <li key={b.id} role="option" aria-selected={b.id === branch.id} className={`${b.id === branch.id ? 'selected' : ''} ${i === cursor ? 'cursor' : ''}`}
              onMouseEnter={() => setCursor(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(b.id); setOpen(false) }}>
              <span className="fin-opt-main"><strong>{b.name}</strong><small>{b.address || 'No address yet'}</small></span>
              {b.tin ? <span className="fin-opt-tin">TIN {b.tin}</span> : <span className="fin-opt-notin"><span aria-hidden="true">⚠</span> No TIN yet</span>}
              {b.id === branch.id && <span className="fin-opt-check"><Check /><span className="fin-sr">Selected</span></span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Presentational: everything the card shows, driven by props (testable without a network).
export function ClinicDetailsView({ branches, branch, clinicName, banner = '', onPick = () => {} }) {
  return (
    <>
      <div className="fin-infonote" role="note">
        <span aria-hidden="true">ⓘ</span>
        <span>These details are managed by the <strong>Super Admin</strong> under Branches. When they update a branch, it changes here automatically.</span>
      </div>
      {banner && <div className="fin-banner" role="alert">{banner}</div>}

      {!branches.length ? (
        <p className="fin-note warn" role="status">No branches are assigned to your account yet. Ask the Super Admin to set you as the owner in Branches → Edit branch → Owner.</p>
      ) : (
        <>
          <div className="fin-pickerrow">
            <div className="fin-ropicklabel"><span className="fin-rolabel">Branch</span></div>
            <BranchPicker branches={branches} branch={branch} onPick={onPick} />
            <span className="fin-hint">{branches.length} branch{branches.length === 1 ? '' : 'es'} · pick one to view its details</span>
          </div>

          <dl className="fin-addrstrip">
            <div><dt>ADDRESS</dt><dd>{branch.address || NOT_PROVIDED}</dd></div>
            <div><dt>PHONE</dt><dd>{branch.phone || NOT_PROVIDED}</dd></div>
          </dl>

          <div className="fin-grid3">
            <ROField label="CLINIC NAME" value={clinicName} />
            <div className="fin-rofield">
              <ROField label="BUSINESS / TAX ID (TIN)" value={branch.tin} tone={branch.tin ? '' : 'missing'}>
                {!branch.tin && <span className="fin-notset">Not set yet</span>}
              </ROField>
              {!branch.tin && <p className="fin-notin-msg" role="alert"><span aria-hidden="true">⚠</span> No TIN yet. This branch can’t send invoices until the Super Admin adds one.</p>}
            </div>
            <ROField label="BILLING EMAIL" value={branch.billingEmail} />
          </div>
          <div className="fin-grid3"><ROField label="WEBSITE" value={branch.website} /></div>
          <ROField label="PAYMENT INSTRUCTIONS" value={branch.paymentInstructions} multiline />
          <ROField label="DEFAULT INVOICE TERMS" value={branch.defaultInvoiceTerms} multiline />
          <p className="fin-hint fin-roFoot">Something wrong or missing? Ask the Super Admin to update it. Invoices already sent keep the details they were issued with.</p>
        </>
      )}
    </>
  )
}

export default function ClinicDetailsCard() {
  const [branches, setBranches] = useState(null)
  const [clinicName, setClinicName] = useState('')
  const [branchId, setBranchId] = useState('') // the last selected branch is kept in page state
  const [banner, setBanner] = useState('')

  useEffect(() => {
    call('billing/branches').then((d) => { setBranches(d.branches); setClinicName(d.clinicName); if (d.branches[0]) setBranchId(d.branches[0].id) })
      .catch((e) => { setBranches([]); setBanner(errMsg(e)) })
  }, [])
  const branch = useMemo(() => branches?.find((b) => b.id === branchId) || branches?.[0] || null, [branches, branchId])

  return (
    <section className="sba-card fin-page" style={{ gridColumn: '1 / -1' }}>
      <div className="fin-cardtitle">
        <h3 className="sba-card-title">Clinic details on invoices</h3>
        <span className="fin-viewonly"><Lock /> View only</span>
      </div>
      <p className="sba-card-sub">Shown in the header of every invoice. Address and phone come from the branch.</p>
      {branches === null ? <p className="fin-hint">{banner || 'Loading…'}</p> : (
        <ClinicDetailsView branches={branches} branch={branch} clinicName={clinicName} banner={banner} onPick={setBranchId} />
      )}
    </section>
  )
}
