// Shared look-and-feel for the owner Gamified Activities pages. Same palette,
// card style, buttons and donut as the therapist Stats pages
// (TherapistGamifiedStatsPage / TherapistPatientStatsPage) so the two read as
// one system. Tailwind preflight is off in this app, so every button spells
// out its own reset.
export const GREEN_900 = '#1F3D36'
export const GREEN_700 = '#234C40'
export const MUTED = '#5D7770'
export const BORDER = '#E3E8E4'
export const CARD = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 20 }
export const FONT = "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif"
export const TYPE_COLOR = { Cognitive: '#7C5CE0', Speech: '#1FA58A', Occupational: '#F59E0B', Physical: '#4A90D9' }
export const LINE_COLORS = ['#1FA58A', '#7C5CE0', '#EC4899', '#F59E0B', '#4A90D9', '#14B8A6']
export const RANGE_OPTIONS = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
]
export const AVATAR_COLORS = ['#EC4899', '#234C40', '#F59E0B', '#4A90D9', '#1FA58A', '#7C5CE0']

export function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}
export function avatarColor(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
export function fmtDate(iso, withYear = true) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })
}
// A drop is shown in the same neutral grey as "no change" — only gains are green.
export function Delta({ value, suffix = '' }) {
  if (value === null || value === undefined) return null
  if (value === 0) return <span style={{ color: MUTED, fontSize: 14, fontWeight: 600 }}> ±0</span>
  return <span style={{ color: value > 0 ? '#16a34a' : MUTED, fontSize: 14, fontWeight: 700 }}> {value > 0 ? `+${value}` : value}{suffix}</span>
}

export function Avatar({ id, name, size = 38 }) {
  return (
    <span className="flex flex-shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.34, background: avatarColor(id) }} aria-hidden="true">{initials(name)}</span>
  )
}

export function PrimaryButton({ children, onClick, disabled, style, ...rest }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}
      style={{ background: GREEN_700, color: '#fff', border: 'none', borderRadius: 999, padding: '0 18px', minHeight: 44, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...style }}>
      {children}
    </button>
  )
}
export function SecondaryButton({ children, onClick, active, style, ...rest }) {
  return (
    <button type="button" onClick={onClick} {...rest}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: active ? '#F1F5F3' : '#fff', border: `1px solid ${BORDER}`, color: GREEN_900, borderRadius: 999, padding: '0 16px', minHeight: 44, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', ...style }}>
      {children}
    </button>
  )
}
export function CardTitle({ children, sub, right }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 style={{ fontSize: 17, fontWeight: 700, color: GREEN_900, margin: 0, letterSpacing: '-0.01em' }}>{children}</h2>
        {sub && <p style={{ fontSize: 12.5, color: MUTED, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}
export function SkeletonBlock({ style }) { return <div className="animate-pulse rounded-2xl bg-[#EDF2F0]" style={style} /> }
export function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 text-[14px] font-bold" style={{ borderColor: '#F3D284', background: '#FFF7E6', color: '#92400E' }}>
      <span>{message}</span>
      <PrimaryButton onClick={onRetry}>Retry</PrimaryButton>
    </div>
  )
}

export function Donut({ segments, total, unit }) {
  let acc = 0
  const stops = segments.map((s) => { const start = acc; acc += s.share; return `${TYPE_COLOR[s.type] || '#94A3B8'} ${start}% ${acc}%` })
  const bg = segments.length ? `conic-gradient(${stops.join(',')})` : '#F1F5F3'
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[110px] w-[110px] flex-shrink-0 rounded-full" style={{ background: bg }} role="img"
        aria-label={`Share by therapy type: ${segments.map((s) => `${s.type} ${s.share}%`).join(', ') || 'no data'}`}>
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-[18px] font-extrabold" style={{ color: GREEN_900 }}>{total}</span>
          <span className="text-[10px] font-bold" style={{ color: MUTED }}>{unit}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {segments.map((s) => (
          <li key={s.type} className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: GREEN_900 }}>
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: TYPE_COLOR[s.type] || '#94A3B8' }} />
            {s.type} <span style={{ color: MUTED, fontWeight: 500 }}>{s.share}%</span>
          </li>
        ))}
        {segments.length === 0 && <li className="text-[12.5px]" style={{ color: MUTED }}>No games in this range yet</li>}
      </ul>
    </div>
  )
}

// A bar with an optional thinner grey comparison bar underneath (patient vs
// branch average).
export function CompareBar({ label, value, shown, max, color, compare, compareShown }) {
  const pct = (v) => `${Math.min(100, Math.max(0, (v / (max || 1)) * 100))}%`
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px] font-bold" style={{ color: GREEN_900 }}>
        <span>{label}</span>
        <span>{shown} {compareShown != null && <span style={{ color: MUTED, fontWeight: 500 }}>vs {compareShown}</span>}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
        <div className="h-full rounded-full" style={{ width: pct(value), background: color }} />
      </div>
      {compare != null && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
          <div className="h-full rounded-full" style={{ width: pct(compare), background: '#B8C4BF' }} />
        </div>
      )}
    </div>
  )
}

// Spreadsheet apps run text that starts with = + - @ as a formula; prefix
// those so exported patient/therapist names can't execute.
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
export function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
