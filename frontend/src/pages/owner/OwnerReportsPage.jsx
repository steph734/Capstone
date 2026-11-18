import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import DateRangeFilter from './reports/DateRangeFilter'
import KpiCard from './reports/KpiCard'
import ReportModuleCard, { MODULE_DEFS } from './reports/ReportModuleCard'
import { ReportViewModal, CustomReportModal } from './reports/ReportModals'
import { downloadExport, useReportsSummary } from './reports/reportApi'
import { apiQuery, compareFor, defaultRange, fmtRange, fmtRangeShort, paramsForRange, rangeFromParams } from './reports/reportRange'
import './OwnerReportsPage.css'

const KPI_DEFS = [
  { key: 'gross', label: 'Total collected (gross)', hint: 'All payments recorded in the selected range, paid or still pending.' },
  { key: 'paid', label: 'Paid', hint: 'Payments in the selected range that have been paid.' },
  { key: 'outstanding', label: 'Outstanding', hint: 'Billed but unpaid at the end of the selected range.' },
  { key: 'growth', label: 'Latest growth', hint: 'Growth of gross collections in the selected range versus the comparison range.' },
]

function ExportAllMenu({ disabled, busyKey, onExport }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="orp-exportall" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <button
        type="button"
        className="orp-btn orp-btn-outline"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? 'No data in this range to export' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {busyKey?.startsWith('all:') ? <span className="orp-spinner" aria-hidden="true" /> : <span aria-hidden="true">⬇</span>} Export all <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="orp-menu" role="menu">
          {['csv', 'pdf'].map((f) => (
            <button key={f} type="button" role="menuitem" onClick={() => { setOpen(false); onExport('all', f, 'Full report') }}>{f.toUpperCase()}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OwnerReportsPage({ user, onLogout, betaTier }) {
  // The ONE source of truth: the range in the URL (?from=&to=). Everything below is derived from it, so a refresh,
  // a shared link and the Back button all restore the same view.
  const [params, setParams] = useSearchParams()
  const { range, compare, compareCustom } = useMemo(() => rangeFromParams(params), [params])
  const query = apiQuery(range, compare, compareCustom)
  const isDefault = useMemo(() => {
    const d = defaultRange()
    return range.from === d.from && range.to === d.to && compare === 'previous_period'
  }, [range, compare])

  const { data, loading, error, reload, loadedQuery } = useReportsSummary(query)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [builder, setBuilder] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const applyRange = ({ range: next, compare: nextCompare, compareCustom: nextCustom }) => {
    setParams(paramsForRange(next, nextCompare, nextCustom)) // pushes a history entry, so Back works
  }
  const resetRange = () => setParams(new URLSearchParams())

  const synced = loadedQuery === query // the numbers on screen belong to the range in the URL
  const compareRange = data?.compareRange || compareFor(range, compare, compareCustom)
  const kpiCompareText = fmtRangeShort(compareRange.from, compareRange.to)
  const rangeText = fmtRangeShort(range.from, range.to)
  const dim = loading && !!data

  const runExport = async (module, format, title, extra = '') => {
    setBusyKey(`${module}:${format}`)
    try {
      const name = await downloadExport(module, format, query, extra)
      notify(`${title} exported as ${format.toUpperCase()} · ${name}`)
      logActivity({
        role: 'Owner', user: user?.name || 'Owner', email: user?.email || '—', actionIcon: '📤', action: 'Report',
        description: `Exported ${title} as ${format.toUpperCase()} for ${fmtRange(range.from, range.to)}`, entity: `Report · ${title}`, status: 'Success',
      })
    } catch (err) {
      notify(err.message || `Could not export ${title}.`, 'error')
    } finally {
      setBusyKey('')
    }
  }

  const noData = !!data && data.empty
  const exportsOff = !data || noData

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Reports"
      subtitle="Financial summary and report modules for your clinic"
      menuItems={getOwnerMenuItems(betaTier)}
      headerActions={<ExportAllMenu disabled={exportsOff} busyKey={busyKey} onExport={runExport} />}
    >
      <div className="orp-page" aria-busy={loading}>
        <DateRangeFilter
          range={range}
          compare={compare}
          compareCustom={compareCustom}
          compareRange={synced ? data?.compareRange : null}
          loading={loading}
          isDefault={isDefault}
          clamped={!!data?.clamped && synced}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onApply={applyRange}
          onReset={resetRange}
        />

        {error && (
          <div className="orp-banner" role="alert">
            <span><strong>Couldn't load reports.</strong> {error.message}</span>
            <button type="button" className="orp-btn orp-btn-outline" onClick={reload}>Retry</button>
          </div>
        )}

        <div className="orp-kpis">
          {KPI_DEFS.map((def) => (
            <KpiCard key={def.key} def={def} kpi={data?.kpis.find((k) => k.key === def.key)} compareText={kpiCompareText} loading={dim} empty={noData} />
          ))}
        </div>

        <div className="orp-section-head">
          <h2>Report modules</h2>
          <p>All modules follow the selected date range</p>
        </div>

        <div className="orp-modules">
          {MODULE_DEFS.map((def) => (
            <ReportModuleCard
              key={def.key}
              def={def}
              mod={data?.modules.find((m) => m.key === def.key)}
              loading={dim}
              rangeText={rangeText}
              busyKey={busyKey}
              onView={setViewing}
              onExport={runExport}
              onPickRange={() => setPickerOpen(true)}
            />
          ))}
        </div>

        <div className="orp-bottom">
          <section className="orp-bottom-card" aria-label="Full export">
            <div>
              <h3>Full export</h3>
              <p>Revenue, attendance, patients, services, retention and staff efficiency in one file.</p>
            </div>
            <div className="orp-actions">
              <button type="button" className="orp-btn orp-btn-primary" onClick={() => runExport('all', 'csv', 'Full report')} disabled={exportsOff || !!busyKey} title={exportsOff ? 'No data in this range to export' : undefined}>
                {busyKey === 'all:csv' ? <span className="orp-spinner light" aria-hidden="true" /> : 'CSV'}
              </button>
              <button type="button" className="orp-btn orp-btn-outline" onClick={() => runExport('all', 'pdf', 'Full report')} disabled={exportsOff || !!busyKey} title={exportsOff ? 'No data in this range to export' : undefined}>
                {busyKey === 'all:pdf' ? <span className="orp-spinner" aria-hidden="true" /> : 'PDF'}
              </button>
            </div>
          </section>
          <section className="orp-bottom-card" aria-label="Custom report builder">
            <div>
              <h3>Custom report builder</h3>
              <p>Pick the metrics to combine into a single file.</p>
            </div>
            <button type="button" className="orp-btn orp-btn-outline" onClick={() => setBuilder(true)} disabled={!data}>Build report</button>
          </section>
        </div>
      </div>

      {viewing && data && (
        <ReportViewModal
          def={viewing}
          mod={data.modules.find((m) => m.key === viewing.key)}
          labels={data.labels}
          range={range}
          query={query}
          busyKey={busyKey}
          onExport={runExport}
          onClose={() => setViewing(null)}
        />
      )}
      {builder && <CustomReportModal range={range} busyKey={busyKey} onExport={runExport} onClose={() => setBuilder(false)} />}

      {toast && <div className={`orp-toast ${toast.kind}`} role="status">{toast.msg}</div>}
    </OwnerPageShell>
  )
}
