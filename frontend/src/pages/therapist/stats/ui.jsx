import { useRef, useState } from 'react'

// Shared look + small controls for the therapist Patient Stats page.
export const GREEN_900 = '#1F3D36'
export const GREEN_700 = '#2E5E4E'
export const MUTED = '#5D7770'
export const BORDER = '#E3EDE8'
export const THERAPY = '#7B5BE0'
export const HOME = '#1FA48C'
export const AMBER_BG = '#FFF3D9'
export const AMBER_FG = '#8A5A0B'
export const CARD = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 22, padding: 24, minWidth: 0 }

// Chip text never wraps; the row of chips wraps instead.
export function Chip({ children, bg = '#EEF3F0', fg = GREEN_900, style }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', background: bg, color: fg, borderRadius: 999, padding: '4px 12px', fontSize: 14, fontWeight: 700, ...style }}>{children}</span>
}

// Segmented control for the Overview | By game | Trends tabs. Arrow keys, Home and End move between tabs.
export function SegmentedTabs({ tabs, value, onChange, label }) {
  const refs = useRef([])
  const go = (n) => { onChange(tabs[n].id); refs.current[n]?.focus() }
  const onKey = (e, i) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go((i + 1) % tabs.length) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go((i - 1 + tabs.length) % tabs.length) }
    else if (e.key === 'Home') { e.preventDefault(); go(0) }
    else if (e.key === 'End') { e.preventDefault(); go(tabs.length - 1) }
  }
  return (
    <div role="tablist" aria-label={label} style={{ display: 'inline-flex', gap: 2, background: '#EAF0ED', borderRadius: 999, padding: 4, maxWidth: '100%', overflowX: 'auto' }}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => { refs.current[i] = el }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={value === t.id} aria-controls={`panel-${t.id}`} tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}
          style={{ whiteSpace: 'nowrap', minHeight: 40, padding: '0 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: value === t.id ? '#fff' : 'transparent', color: value === t.id ? GREEN_900 : MUTED, boxShadow: value === t.id ? '0 1px 3px rgba(31,61,54,.15)' : 'none' }}>{t.label}</button>
      ))}
    </div>
  )
}

// "Chart | Table" switch used on every chart.
export function ChartTableSwitch({ asTable, onChange, label = 'View' }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', background: '#EAF0ED', borderRadius: 999, padding: 3, flexShrink: 0 }}>
      {[['Chart', false], ['Table', true]].map(([text, v]) => (
        <button key={text} type="button" aria-pressed={asTable === v} onClick={() => onChange(v)}
          style={{ whiteSpace: 'nowrap', minHeight: 36, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: asTable === v ? '#fff' : 'transparent', color: asTable === v ? GREEN_900 : MUTED, boxShadow: asTable === v ? '0 1px 2px rgba(31,61,54,.15)' : 'none' }}>{text}</button>
      ))}
    </div>
  )
}

// A card with a title, optional subtitle and legend, and the Chart | Table switch. `chart` and `table` are the two views.
export function ChartCard({ title, subtitle, legend, chart, table, note, style }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section style={{ ...CARD, ...style }} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
        {table && <ChartTableSwitch asTable={asTable} onChange={setAsTable} label={`${title}: chart or table`} />}
      </div>
      {legend && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{legend}</div>}
      <div className="mt-3">{asTable && table ? table : chart}</div>
      {note}
    </section>
  )
}

export function LegendDot({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: GREEN_900, whiteSpace: 'nowrap' }}>
      {dashed
        ? <span aria-hidden="true" style={{ width: 18, borderTop: `2px dashed ${color}`, display: 'inline-block' }} />
        : <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />}
      {label}
    </span>
  )
}

// Accessible HTML table twin of a chart. First column left, the rest right-aligned; scrolls inside its card.
export function DataTable({ caption, head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ fontSize: 14 }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr style={{ color: MUTED, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {head.map((h, i) => <th key={`${h}-${i}`} scope="col" className="pb-2 pr-3" style={{ textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}>
              {r.map((c, j) => <td key={j} className="py-2 pr-3" style={{ textAlign: j === 0 ? 'left' : 'right', fontWeight: j === 0 ? 700 : 500, color: GREEN_900 }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A Pao picture with words and optional buttons. `tone` "dashed" = empty state, "blue" = summary banner.
export function PaoNote({ src, eyebrow, title, children, actions, tone = 'dashed', style }) {
  const base = tone === 'dashed'
    ? { border: '1.5px dashed #C9D9D2', background: '#F7FAF8' }
    : { border: `1px solid ${BORDER}`, background: 'linear-gradient(135deg,#E3F0FD,#E3F6EA)' }
  return (
    <div className="flex flex-wrap items-center gap-4" style={{ borderRadius: 20, padding: 20, ...base, ...style }}>
      <img src={src} alt="" width="84" height="84" style={{ width: 84, height: 84, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        {eyebrow && <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#2F6F9F', margin: 0 }}>{eyebrow}</p>}
        {title && <p style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>{title}</p>}
        <p style={{ fontSize: 16, lineHeight: 1.45, color: eyebrow ? GREEN_900 : MUTED, fontWeight: eyebrow ? 700 : 400, margin: '2px 0 0' }}>{children}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Btn({ children, onClick, primary, disabled, style, ...rest }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}
      style={{ whiteSpace: 'nowrap', minHeight: 44, padding: '0 20px', borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
        background: primary ? GREEN_700 : '#fff', color: primary ? '#fff' : GREEN_900, border: primary ? 'none' : `1px solid ${BORDER}`, ...style }}>{children}</button>
  )
}

export function SectionLabel({ children }) {
  return <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, margin: '12px 0 -4px' }}>{children}</h2>
}
