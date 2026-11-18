import { describe, expect, it } from 'vitest'
import { renderToString as render } from 'react-dom/server'
const renderToString = (el) => render(el).replace(/<!-- -->/g, '')
import KpiCard from './KpiCard'
import ReportModuleCard, { MODULE_DEFS } from './ReportModuleCard'
import DateRangeFilter from './DateRangeFilter'

const kpi = { key: 'outstanding', label: 'Outstanding', valueFormat: 'money', value: 3010000, previousValue: 2900000, changePct: 3.8, deltaUnit: 'pct', goodDirection: 'down', tone: 'bad', series: [1, 3, 2, 5] }

describe('reports components', () => {
  it('KpiCard shows value, word for direction, and bad tone for Outstanding up', () => {
    const html = renderToString(<KpiCard def={{ label: 'Outstanding', hint: 'x' }} kpi={kpi} compareText="Aug 1 – Aug 31" />)
    expect(html).toContain('₱30,100')
    expect(html).toContain('tone-bad')
    expect(html).toMatch(/Up 3\.8%/)
    expect(html).toContain('role="img"')
  })
  it('KpiCard renders a skeleton before data', () => {
    expect(renderToString(<KpiCard def={{ label: 'Paid' }} compareText="x" />)).toContain('is-skeleton')
  })
  it('ReportModuleCard: metric, buttons, empty state disables exports', () => {
    const mod = { key: 'revenue', metricLabel: 'Months covered', metricValue: 1, metricFormat: 'number', series: [1, 2], empty: false }
    const ok = renderToString(<ReportModuleCard def={MODULE_DEFS[0]} mod={mod} rangeText="Oct 1 – Oct 31" busyKey="" onView={() => {}} onExport={() => {}} onPickRange={() => {}} />)
    expect(ok).toContain('Months covered')
    expect(ok).toContain('View report')
    const empty = renderToString(<ReportModuleCard def={MODULE_DEFS[0]} mod={{ ...mod, empty: true }} rangeText="Oct 1 – Oct 31" busyKey="" onView={() => {}} onExport={() => {}} onPickRange={() => {}} />)
    expect(empty).toContain('No data for Oct 1 – Oct 31')
    expect(empty).toContain('Try a different range')
    expect(empty).toContain('disabled')
  })
  it('DateRangeFilter renders the segmented control, chip, and the open picker with calendars', () => {
    const html = renderToString(
      <DateRangeFilter range={{ from: '2026-10-01', to: '2026-10-31' }} compare="previous_period" compareCustom={null} compareRange={{ from: '2026-08-31', to: '2026-09-30' }}
        loading={false} isDefault={false} clamped={false} open onOpenChange={() => {}} onApply={() => {}} onReset={() => {}} />
    )
    expect(html).toContain('Last month')
    expect(html).toContain('Compared with Aug 31 – Sep 30')
    expect(html).toContain('numbers updated')
    expect(html).toContain('October 2026')
    expect(html).toContain('November 2026')
    expect(html).toContain('Apply range')
    expect(html).toContain('31 days')
  })
})
