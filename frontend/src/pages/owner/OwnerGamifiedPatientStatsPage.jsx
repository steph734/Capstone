import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import BadgeMedal from '../../components/BadgeMedal'
import {
  GREEN_900, GREEN_700, MUTED, BORDER, CARD, FONT, RANGE_OPTIONS,
  CardTitle, CompareBar, Donut, ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock, fmtDate, initials,
} from './gamified/shared'

// /owner/gamified-activities/patients/:patientId — read-only per-patient
// dashboard for the clinic owner. Real data from
// GET /api/owner/gamified/patients/:patientId (owner role checked on the
// server; includes the patient's branch averages for the same period). A
// descriptive summary of recorded sessions — no prediction, no diagnosis.
const PAGE_SIZE = 10
const STAT_ICON = { intelligence: '🧠', focus: '🎯', resistance: '🛡️', creativity: '🎨', speed: '⚡', memory: '💭' }
const STAT_COLOR = { intelligence: '#7C5CE0', focus: '#F59E0B', resistance: '#1FA58A', creativity: '#EC4899', speed: '#14B8A6', memory: '#4A90D9' }
const GAME_ICON = { Cognitive: '🧩', Speech: '🗣️', Occupational: '🧶', Physical: '🏃' }

function fmtRangeLabel(days) {
  const to = new Date(); to.setHours(0, 0, 0, 0)
  const from = new Date(to); from.setDate(from.getDate() - (days - 1))
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(from)} – ${fmt(to)}, ${to.getFullYear()}`
}
function Change({ value, unit = '', label = 'vs last period' }) {
  if (value === null || value === undefined) return <span style={{ color: MUTED }}>No previous period to compare</span>
  if (value === 0) return <span style={{ color: MUTED }}>No change {label}</span>
  return <span style={{ color: value > 0 ? '#16a34a' : MUTED, fontWeight: 600 }}>{value > 0 ? '+' : ''}{value}{unit} {label}</span>
}

function KpiTile({ icon, bg, label, value, children }) {
  return (
    <div style={{ ...CARD, display: 'flex', gap: 12, minHeight: 128 }}>
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[18px]" style={{ background: bg }} aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 14, fontWeight: 500, color: MUTED, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 34, fontWeight: 700, color: GREEN_900, margin: '2px 0 0', lineHeight: 1.1 }}>{value}</p>
        <div style={{ fontSize: 12, color: MUTED, margin: '4px 0 0', lineHeight: 1.45 }}>{children}</div>
      </div>
    </div>
  )
}

// Weekly accuracy for the patient with a dashed branch-average line. Weeks
// with no games are gaps, not zeros.
function ProgressChart({ weekly, branchWeekly, branchName }) {
  const [asTable, setAsTable] = useState(false)
  const [hover, setHover] = useState(null)
  const w = 760, h = 220, padL = 40, padR = 12, padT = 12, padB = 28
  const innerW = w - padL - padR, innerH = h - padT - padB
  const have = weekly.filter((p) => p.value !== null)
  if (have.length === 0) return <p className="py-10 text-center text-[13px]" style={{ color: MUTED }}>Not enough data yet — accuracy appears after the first game in this range.</p>

  const stepX = weekly.length > 1 ? innerW / (weekly.length - 1) : 0
  const yFor = (v) => padT + innerH - (Math.min(100, Math.max(0, v)) / 100) * innerH
  const pathFor = (series) => {
    let d = '', pen = false
    series.forEach((p, i) => {
      if (p.value === null || p.value === undefined) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${(padL + i * stepX).toFixed(1)},${yFor(p.value).toFixed(1)} `
      pen = true
    })
    return d.trim()
  }
  const hasBranch = branchWeekly?.some((p) => p.value !== null)

  if (asTable) {
    return (
      <div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Weekly accuracy for this patient and the {branchName} branch average</caption>
            <thead><tr style={{ color: MUTED, textAlign: 'left' }}><th scope="col" className="pb-1 pr-4">Week</th><th scope="col" className="pb-1 pr-4">Patient</th>{hasBranch && <th scope="col" className="pb-1">{branchName} avg</th>}</tr></thead>
            <tbody>
              {weekly.map((p, i) => (
                <tr key={p.weekStart} style={{ borderTop: '1px solid #EDF2F0' }}>
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal" style={{ color: GREEN_900 }}>{p.label} · {fmtDate(p.weekStart, false)}</th>
                  <td className="py-1.5 pr-4" style={{ color: GREEN_900 }}>{p.value !== null ? `${p.value}%` : 'No games'}</td>
                  {hasBranch && <td className="py-1.5" style={{ color: GREEN_900 }}>{branchWeekly[i]?.value != null ? `${branchWeekly[i].value}%` : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SecondaryButton onClick={() => setAsTable(false)} style={{ marginTop: 10 }}>View as chart</SecondaryButton>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img"
          aria-label={`Weekly accuracy: ${weekly.map((p) => `${p.label} ${p.value !== null ? `${p.value}%` : 'no games'}`).join(', ')}`}>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={yFor(t)} y2={yFor(t)} stroke="#EEF2F0" />
              <text x={padL - 8} y={yFor(t) + 3} fontSize="10" textAnchor="end" fill={MUTED}>{t}%</text>
            </g>
          ))}
          {hasBranch && <path d={pathFor(branchWeekly)} fill="none" stroke="#1FA58A" strokeWidth="1.8" strokeDasharray="5 4" />}
          <path d={pathFor(weekly)} fill="none" stroke="#7C5CE0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {weekly.map((p, i) => p.value !== null && (
            <circle key={p.weekStart} cx={padL + i * stepX} cy={yFor(p.value)} r={hover === i ? 6 : 4.5} fill="#7C5CE0" stroke="#fff" strokeWidth="1.5"
              tabIndex={0} style={{ cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          ))}
          {weekly.map((p, i) => <text key={p.weekStart} x={padL + i * stepX} y={h - 8} fontSize="10" textAnchor="middle" fill={MUTED}>{p.label}</text>)}
        </svg>
        {hover !== null && weekly[hover].value !== null && (
          <div className="pointer-events-none absolute rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white shadow"
            style={{ background: GREEN_900, left: `${((padL + hover * stepX) / w) * 100}%`, top: `${(yFor(weekly[hover].value) / h) * 100}%`, transform: 'translate(-50%,-135%)', whiteSpace: 'nowrap' }}>
            {weekly[hover].label} · {weekly[hover].value}%
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-bold" style={{ color: GREEN_900 }}>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: '#7C5CE0', height: 3 }} />Patient</span>
          {hasBranch && <span className="flex items-center gap-1.5"><span style={{ width: 20, borderTop: '2px dashed #1FA58A' }} />{branchName} branch average</span>}
        </div>
        <SecondaryButton onClick={() => setAsTable(true)} style={{ minHeight: 44 }}>View as table</SecondaryButton>
      </div>
    </div>
  )
}

// Average hints per game per week. Weeks with no games are left out so the
// line never sits flat on zero; with no data at all it's a friendly empty state.
function IndependenceChart({ hintsWeekly }) {
  const pts = hintsWeekly.filter((p) => p.games > 0)
  if (pts.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <img src="/pao/png/pao-think.png" alt="" style={{ width: 72, height: 72, objectFit: 'contain' }} />
        <p className="mt-2 text-[13px]" style={{ color: MUTED, maxWidth: '30ch' }}>No games played in this range yet, so there are no hints to chart.</p>
      </div>
    )
  }
  const w = 360, h = 190, padL = 38, padR = 12, padT = 12, padB = 34
  const innerW = w - padL - padR, innerH = h - padT - padB
  const max = Math.max(1, Math.ceil(Math.max(...pts.map((p) => p.value)) * 1.2))
  const stepX = pts.length > 1 ? innerW / (pts.length - 1) : 0
  const xy = pts.map((p, i) => [pts.length > 1 ? padL + i * stepX : padL + innerW / 2, padT + innerH - (p.value / max) * innerH])
  const first = pts[0].value, last = pts[pts.length - 1].value
  const takeaway = pts.length < 2 ? `Only one week of data so far (${last.toFixed(1)} hints per game).`
    : last < first ? `Hints dropped from ${first.toFixed(1)} to ${last.toFixed(1)} per game.`
    : last > first ? `Hints rose from ${first.toFixed(1)} to ${last.toFixed(1)} per game.`
    : `Hints are steady at ${last.toFixed(1)} per game.`
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Hints per game by week: ${pts.map((p) => `${p.label} ${p.value}`).join(', ')}. ${takeaway}`}>
        {[0, 0.5, 1].map((f) => {
          const v = max * f
          const y = padT + innerH - f * innerH
          return <g key={f}><line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#EEF2F0" /><text x={padL - 6} y={y + 3} fontSize="10" textAnchor="end" fill={MUTED}>{Number.isInteger(v) ? v : v.toFixed(1)}</text></g>
        })}
        {xy.length > 1 && <path d={xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke="#EC4899" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#EC4899"><title>{`${pts[i].label}: ${pts[i].value} hints per game`}</title></circle>)}
        {pts.map((p, i) => <text key={p.weekStart} x={xy[i][0]} y={h - 18} fontSize="10" textAnchor="middle" fill={MUTED}>{p.label}</text>)}
        <text x={padL + innerW / 2} y={h - 4} fontSize="10" textAnchor="middle" fill={MUTED}>Week</text>
        <text x="10" y={padT + innerH / 2} fontSize="10" textAnchor="middle" fill={MUTED} transform={`rotate(-90 10 ${padT + innerH / 2})`}>Hints per game</text>
      </svg>
      <p className="mt-2 rounded-xl px-3 py-2 text-[13px] font-bold" style={{ background: '#F5F8F6', color: GREEN_900, margin: '8px 0 0' }}>↓ {takeaway}</p>
    </div>
  )
}

function trendFor(weekly) {
  const v = weekly.filter((p) => p.value !== null).map((p) => p.value)
  if (v.length < 2) return { label: 'Not enough data yet', tone: 'neutral' }
  const diff = v[v.length - 1] - v[0]
  if (diff >= 2) return { label: 'Improving', tone: 'up' }
  if (diff <= -2) return { label: 'Declining', tone: 'down' }
  return { label: 'Steady', tone: 'neutral' }
}

export default function OwnerGamifiedPatientStatsPage({ user, onLogout, betaTier }) {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rangeId = RANGE_OPTIONS.some((r) => r.id === params.get('range')) ? params.get('range') : '30'
  const days = RANGE_OPTIONS.find((r) => r.id === rangeId).days
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [showAllGames, setShowAllGames] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  // Back to the overview keeps its filters: they're all in this page's query string.
  const backHref = `/owner/gamified-activities?${params.toString()}`
  const setRange = (id) => setParams((p) => { const n = new URLSearchParams(p); if (id === '30') n.delete('range'); else n.set('range', id); return n }, { replace: true })

  const load = (signal) => {
    if (!user?.email) return
    setLoading(true); setError('')
    fetch(`/api/owner/gamified/patients/${patientId}?${new URLSearchParams({ email: user.email, range: rangeId })}`, { signal })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setData(b) : setError(b.error || 'Could not load this patient’s stats.')))
      .catch((e) => { if (e.name !== 'AbortError') setError('Could not load this patient’s stats.') })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }
  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [rangeId, patientId, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [rangeId, patientId])

  const sessionsPage = useMemo(() => data?.recentSessions.slice(0, page * PAGE_SIZE) || [], [data, page])
  const trend = data ? trendFor(data.weeklyAccuracy) : null
  const first = data?.profile.name.split(' ')[0] || ''

  // "Message <therapist>": there's no in-app messaging for owners (the
  // /messages inbox is guardian <-> therapist only), so this opens the owner's
  // mail app addressed to the therapist.
  const messageHref = data?.therapist?.email
    ? `mailto:${data.therapist.email}?subject=${encodeURIComponent(`About ${data.profile.name}'s gamified activity`)}`
    : null

  const exportPdf = async () => {
    setPdfBusy(true)
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF()
      const p = data.profile, k = data.kpis, b = data.branch
      doc.setFontSize(18); doc.text(`${p.name} — Gamified Activities report`, 14, 18)
      doc.setFontSize(10); doc.setTextColor(90)
      doc.text(`${fmtRangeLabel(days)}  ·  ${data.branch?.name || 'No branch'}  ·  Therapist: ${data.therapist?.name || '—'}`, 14, 25)
      doc.text(`Level ${p.level}  ·  XP ${p.xp}/${p.xpMax}${p.favoriteGame ? `  ·  Favorite: ${p.favoriteGame}` : ''}`, 14, 31)
      autoTable(doc, {
        startY: 37, head: [['Measure', 'This patient', b ? `${b.name} branch average` : 'Branch average']],
        body: [
          ['Games completed', k.games.value, b?.games ?? '—'],
          ['Average accuracy', k.accuracy.value !== null ? `${Math.round(k.accuracy.value)}%` : '—', b?.accuracy != null ? `${b.accuracy}%` : '—'],
          ['Active days', `${k.activeDays.value} / ${k.activeDays.daysInRange}`, b?.activeDays ?? '—'],
          ['Hints per game', data.hintsWeekly.some((x) => x.games) ? (data.hintsWeekly.reduce((a, x) => a + x.value * x.games, 0) / data.hintsWeekly.reduce((a, x) => a + x.games, 0)).toFixed(1) : '—', b?.hintsPerGame ?? '—'],
          ['Badges earned', `${k.badges.value} / ${k.badges.total}`, '—'],
        ],
        headStyles: { fillColor: [35, 76, 64] },
      })
      doc.setFontSize(11); doc.setTextColor(30)
      const afterKpi = doc.lastAutoTable.finalY + 8
      const summary = doc.splitTextToSize(data.paoSummary, 180)
      doc.text(summary, 14, afterKpi)
      autoTable(doc, {
        startY: afterKpi + summary.length * 5 + 4,
        head: [['Date', 'Game', 'Therapy type', 'Accuracy', 'Hints', 'Min', 'XP']],
        body: data.recentSessions.slice(0, 30).map((s) => [fmtDate(s.date), s.game, s.therapyType || '—', s.accuracy !== null ? `${s.accuracy}%` : '—', s.hints, s.minutes, `+${s.xp}`]),
        headStyles: { fillColor: [35, 76, 64] }, styles: { fontSize: 9 },
      })
      doc.setFontSize(8); doc.setTextColor(120)
      doc.text('Descriptive summary of recorded sessions. It does not diagnose or predict.', 14, 288)
      doc.save(`${p.name.replace(/[^\w-]+/g, '_')}-gamified-report.pdf`)
    } catch (e) {
      alert(e.message || 'Could not create the PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  const hintsPerGame = data && data.hintsWeekly.some((x) => x.games)
    ? Math.round((data.hintsWeekly.reduce((a, x) => a + x.value * x.games, 0) / data.hintsWeekly.reduce((a, x) => a + x.games, 0)) * 10) / 10 : null

  return (
    <OwnerPageShell user={user} onLogout={onLogout} title="Patient Stats" subtitle="Descriptive summary of recorded sessions" menuItems={getOwnerMenuItems(betaTier)} beta>
      <div style={{ fontFamily: FONT }}>
        {/* Breadcrumb + toolbar */}
        <nav aria-label="Breadcrumb" className="mb-2 text-[13px] font-bold" style={{ color: MUTED }}>
          <Link to={`/owner/gamified-activities`} style={{ color: MUTED, textDecoration: 'none' }}>Gamified Activities</Link>
          {' › '}
          <Link to={backHref} style={{ color: MUTED, textDecoration: 'none' }}>Overview</Link>
          {' › '}
          <span aria-current="page" style={{ color: GREEN_900 }}>{data?.profile.name || 'Patient'}</span>
        </nav>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={() => navigate(backHref)}>‹ Back to overview</SecondaryButton>
          <div className="relative sm:ml-auto">
            <SecondaryButton onClick={() => setRangeOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={rangeOpen}>
              🗓️ {fmtRangeLabel(days)} <span style={{ color: MUTED }}>▾</span>
            </SecondaryButton>
            {rangeOpen && (
              <ul role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-10 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg" style={{ border: `1px solid ${BORDER}`, listStyle: 'none', margin: 0, padding: '4px 0' }}>
                {RANGE_OPTIONS.map((r) => (
                  <li key={r.id}>
                    <button type="button" role="option" aria-selected={rangeId === r.id} onClick={() => { setRange(r.id); setRangeOpen(false) }}
                      style={{ display: 'block', width: '100%', minHeight: 44, border: 'none', textAlign: 'left', padding: '0 14px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: rangeId === r.id ? '#F1F5F3' : 'transparent', color: GREEN_900 }}>{r.label}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-1 rounded-full bg-white p-1" style={{ border: `1px solid ${BORDER}` }} role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.id} type="button" aria-pressed={rangeId === r.id} onClick={() => setRange(r.id)}
                style={{ minHeight: 40, borderRadius: 999, border: 'none', padding: '0 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: rangeId === r.id ? GREEN_700 : 'transparent', color: rangeId === r.id ? '#fff' : '#3a4a45' }}>{r.label}</button>
            ))}
          </div>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => load()} />}

        {loading && !data && (
          <div className="grid gap-5">
            <SkeletonBlock style={{ height: 130 }} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} style={{ height: 128 }} />)}</div>
            <SkeletonBlock style={{ height: 300 }} />
          </div>
        )}

        {data && (
          <div className="grid gap-5" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
            {/* Header */}
            <div className="flex flex-wrap items-center gap-4" style={{ ...CARD, minHeight: 130 }}>
              <span className="flex flex-shrink-0 items-center justify-center rounded-full text-[20px] font-extrabold"
                style={{ width: 72, height: 72, background: '#E3F6EA', border: `3px solid ${GREEN_700}`, color: GREEN_700 }} aria-hidden="true">{initials(data.profile.name)}</span>
              <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: GREEN_900, margin: 0, lineHeight: 1.15 }}>{data.profile.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {[
                    data.profile.age != null && `Age ${data.profile.age}`,
                    data.branch && `📍 ${data.branch.name} branch`,
                    data.therapist && `Therapist: ${data.therapist.name}`,
                    data.profile.favoriteGame && `Favorite: ${data.profile.favoriteGame}`,
                    data.profile.lastPlayedAt && `Last played ${fmtDate(data.profile.lastPlayedAt, false)}`,
                  ].filter(Boolean).map((t) => <span key={t} className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: '#F1F5F3', color: MUTED }}>{t}</span>)}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: '#FFF1D6' }}>
                <span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: '#FFE1A6', color: '#92400E' }}>⭐ LVL {data.profile.level}</span>
                <div>
                  <p className="text-[12.5px] font-bold" style={{ color: GREEN_900, margin: 0 }}>
                    XP {data.profile.xp} / {data.profile.xpMax}
                    <span style={{ color: MUTED, fontWeight: 400 }}> · {Math.max(0, data.profile.xpMax - data.profile.xp)} to go</span>
                  </p>
                  <div className="mt-1.5 h-2 w-[150px] max-w-full overflow-hidden rounded-full" style={{ background: '#FFFFFF90' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (data.profile.xp / data.profile.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#FFC933)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiTile icon="🎮" bg="#DCEBFC" label="Games completed" value={data.kpis.games.value}>
                <Change value={data.kpis.games.change} />{data.branch && data.branch.games != null && <> · branch avg {data.branch.games}</>}
              </KpiTile>
              <KpiTile icon="🎯" bg="#D9F2E3" label="Average accuracy" value={data.kpis.accuracy.value !== null ? `${Math.round(data.kpis.accuracy.value)}%` : '—'}>
                <Change value={data.kpis.accuracy.change} unit=" pts" />{data.branch && data.branch.accuracy != null && <> · branch avg {Math.round(data.branch.accuracy)}%</>}
              </KpiTile>
              <KpiTile icon="🏆" bg="#FDEBC8" label="Badges earned" value={<>{data.kpis.badges.value}<span style={{ fontSize: 18, color: MUTED }}> / {data.kpis.badges.total}</span></>}>
                {data.kpis.badges.newThisRange > 0 ? `${data.kpis.badges.newThisRange} new this period` : 'No new badges this period'}
              </KpiTile>
              <KpiTile icon="💗" bg="#FBDCE5" label="Active days" value={<>{data.kpis.activeDays.value}<span style={{ fontSize: 18, color: MUTED }}> / {data.kpis.activeDays.daysInRange}</span></>}>
                <Change value={data.kpis.activeDays.change} unit=" days" />
                {data.kpis.activeDays.dayFlags && (
                  <div className="mt-1.5 flex flex-wrap gap-[3px]" role="img" aria-label={`${data.kpis.activeDays.value} active days out of ${data.kpis.activeDays.daysInRange}`}>
                    {data.kpis.activeDays.dayFlags.map((on, i) => <span key={i} className="rounded-sm" style={{ width: 8, height: 8, background: on ? '#1FA58A' : '#E3E8E4' }} />)}
                  </div>
                )}
              </KpiTile>
            </div>

            {/* Progress | Compared with branch */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.7fr_1fr]">
              <div style={CARD}>
                <CardTitle sub={data.branch ? `Accuracy per week · dashed line = ${data.branch.name} branch average` : 'Accuracy per week'}
                  right={<span className="rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ background: trend.tone === 'up' ? '#D9F2E3' : '#F1F5F3', color: trend.tone === 'up' ? '#16a34a' : MUTED, whiteSpace: 'nowrap' }}>{trend.label}</span>}>
                  Progress over time
                </CardTitle>
                <ProgressChart weekly={data.weeklyAccuracy} branchWeekly={data.branch?.weeklyAccuracy} branchName={data.branch?.name || 'Branch'} />
              </div>

              <div style={CARD}>
                <CardTitle sub={data.branch ? `${first} vs ${data.branch.name} branch average (${data.branch.patients} patients)` : 'No branch on file'}>Compared with branch</CardTitle>
                {data.branch ? (
                  <div className="flex flex-col gap-4">
                    {(() => {
                      const k = data.kpis, b = data.branch
                      const acc = k.accuracy.value !== null ? Math.round(k.accuracy.value) : null
                      const gMax = Math.max(1, k.games.value, b.games || 0)
                      const dMax = Math.max(1, k.activeDays.value, b.activeDays || 0)
                      const hMax = Math.max(1, hintsPerGame || 0, b.hintsPerGame || 0)
                      return (
                        <>
                          <CompareBar label="Games completed" value={k.games.value} shown={k.games.value} max={gMax} color="#1FA58A" compare={b.games} compareShown={b.games} />
                          <CompareBar label="Average accuracy" value={acc || 0} shown={acc !== null ? `${acc}%` : '—'} max={100} color="#7C5CE0" compare={b.accuracy} compareShown={b.accuracy != null ? `${Math.round(b.accuracy)}%` : '—'} />
                          <CompareBar label="Active days" value={k.activeDays.value} shown={k.activeDays.value} max={dMax} color="#EC4899" compare={b.activeDays} compareShown={b.activeDays} />
                          <CompareBar label="Hints per game" value={hintsPerGame || 0} shown={hintsPerGame ?? '—'} max={hMax} color="#F59E0B" compare={b.hintsPerGame} compareShown={b.hintsPerGame ?? '—'} />
                        </>
                      )
                    })()}
                    <p className="flex items-center gap-3 text-[11.5px] font-bold" style={{ color: MUTED, margin: 0 }}>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: GREEN_700 }} />{first}</span>
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2.5 rounded-full" style={{ background: '#B8C4BF' }} />Branch average</span>
                    </p>
                  </div>
                ) : <p className="text-[13px]" style={{ color: MUTED }}>This patient's therapist has no branch on file, so there's no average to compare with.</p>}
              </div>
            </div>

            {/* Character stats | Time by therapy type | Badges */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div style={CARD}>
                <CardTitle right={<span style={{ fontSize: 12, color: MUTED }}>vs. last month</span>}>Character stats</CardTitle>
                <div className="flex flex-col gap-3">
                  {data.characterStats.map((s) => (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[16px]" style={{ background: '#F1F5F3' }} aria-hidden="true">{STAT_ICON[s.key] || '⭐'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[13px]" style={{ color: GREEN_900 }}>
                          <span style={{ fontWeight: 500 }}>{s.label}</span>
                          <span style={{ fontWeight: 700 }}>{s.value} / 100 {s.change ? <span className="ml-1 rounded-full px-1.5 py-0.5" style={{ background: '#D9F2E3', color: '#16a34a', fontSize: 11 }}>↑ +{s.change}</span> : null}</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.value)}%`, background: STAT_COLOR[s.key] || GREEN_700 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={CARD}>
                <CardTitle sub={`Share of play time · ${Math.floor(data.totalMinutes / 60)} h ${data.totalMinutes % 60} min total`}>Time by therapy type</CardTitle>
                <Donut segments={data.shareByType} total={data.totalMinutes} unit="minutes" />
                {data.typeNote && <p className="mt-3 rounded-xl px-3 py-2 text-[13px]" style={{ color: MUTED, background: '#F5F8F6', lineHeight: 1.4 }}>💡 {data.typeNote.replace(/ — consider assigning more\./, '.')}</p>}
              </div>

              <div style={CARD} className="md:col-span-2 lg:col-span-1">
                <CardTitle right={<span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: '#F1F5F3', color: MUTED }}>{data.badges.filter((b) => b.earned).length} of {data.badges.length}{data.newThisRange ? ` · ${data.newThisRange} new` : ''}</span>}>Badges earned</CardTitle>
                <div className="grid grid-cols-3 gap-3">
                  {data.badges.slice(0, showAllBadges ? data.badges.length : 6).map((b) => (
                    <div key={b.code} className="flex flex-col items-center gap-1">
                      <BadgeMedal shape={b.shape} colour={b.colour} symbol={b.symbol} size={44} muted={!b.earned} />
                      <span className="text-center text-[10px] font-bold" style={{ color: MUTED }}>{b.name}</span>
                    </div>
                  ))}
                </div>
                {data.badges.length > 6 && <SecondaryButton onClick={() => setShowAllBadges((v) => !v)} style={{ marginTop: 8 }}>{showAllBadges ? 'Show less' : 'View all'}</SecondaryButton>}
                {data.nextBadge && <p className="mt-3 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: '#FFF1D6', color: '#92400E', margin: '12px 0 0' }}>Next badge: {data.nextBadge.name}</p>}
              </div>
            </div>

            {/* Recent games | Weekly completion | Independence */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div style={CARD}>
                <CardTitle right={data.recentGames.length > 0 && <SecondaryButton onClick={() => setShowAllGames((v) => !v)}>{showAllGames ? 'Show less' : 'View all →'}</SecondaryButton>}>Recent games</CardTitle>
                <div className="flex flex-col gap-2.5">
                  {(showAllGames ? data.recentSessions.slice(0, 30) : data.recentGames).map((g, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: GREEN_900 }}>
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[14px]" style={{ background: '#F1F5F3' }} aria-hidden="true">{GAME_ICON[g.therapyType] || '🎮'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ fontWeight: 700, margin: 0 }}>{g.name || g.game}</p>
                        <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>{g.therapyType || ''}{g.therapyType ? ' · ' : ''}{fmtDate(g.date, false)}</p>
                      </div>
                      {'stars' in g && <span style={{ color: '#F59E0B', fontSize: 11 }} aria-label={`${g.stars} of 5 stars`}>{'★'.repeat(g.stars)}{'☆'.repeat(5 - g.stars)}</span>}
                      <span style={{ color: MUTED, fontWeight: 700 }}>{g.accuracy !== null ? `${g.accuracy}%` : '—'}</span>
                    </div>
                  ))}
                  {data.recentGames.length === 0 && <p className="text-[12.5px]" style={{ color: MUTED }}>No games yet.</p>}
                </div>
              </div>

              <div style={CARD}>
                <CardTitle sub="Assigned vs completed games">Weekly completion</CardTitle>
                {(() => {
                  const weeks = data.weekly.slice(-5)
                  const maxTotal = Math.max(1, ...weeks.map((x) => Math.max(x.assigned, x.completed)))
                  const done = data.weekly.reduce((a, x) => a + x.completed, 0)
                  const assigned = data.weekly.reduce((a, x) => a + Math.max(x.assigned, x.completed), 0)
                  const pct = assigned > 0 ? Math.round((done / assigned) * 100) : null
                  return (
                    <>
                      <div className="flex items-end justify-between gap-2" style={{ height: 150 }}>
                        {weeks.map((x) => {
                          const total = Math.max(x.assigned, x.completed)
                          const totalH = Math.max(4, (total / maxTotal) * 120)
                          return (
                            <div key={x.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: GREEN_900 }}>{x.completed}</span>
                              <div className="relative overflow-hidden rounded-t" style={{ width: 28, height: totalH, background: '#E8EEEA' }} title={`${x.label}: ${x.completed} of ${total}`}>
                                <div className="absolute bottom-0 w-full rounded-t" style={{ height: total > 0 ? (x.completed / total) * totalH : 0, background: '#1FA58A' }} />
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED }}>{x.label}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] font-bold" style={{ color: MUTED }}>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#1FA58A' }} /> Completed</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#E8EEEA' }} /> Assigned</span>
                        {pct !== null && <span style={{ color: '#16a34a', marginLeft: 'auto' }}>{pct}% completion</span>}
                      </div>
                    </>
                  )
                })()}
              </div>

              <div style={CARD} className="md:col-span-2 lg:col-span-1">
                <CardTitle sub={`Hints used per game — fewer means ${first} needs less help`}>Independence</CardTitle>
                <IndependenceChart hintsWeekly={data.hintsWeekly} />
              </div>
            </div>

            {/* Pao's summary (owner actions only) */}
            <div style={{ ...CARD, background: 'linear-gradient(135deg,#E3F0FD,#E3F6EA)' }}>
              <div className="flex flex-wrap items-start gap-4">
                <img src="/pao/png/pao-hooray.png" alt="" className="h-16 w-16 flex-shrink-0 object-contain" />
                <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: MUTED, margin: 0 }}>Pao's summary</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: GREEN_900, lineHeight: 1.45, margin: '4px 0 0' }}>{data.paoSummary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {messageHref
                      ? <a href={messageHref} style={{ background: GREEN_700, color: '#fff', borderRadius: 999, padding: '0 18px', minHeight: 44, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>✉ Message {data.therapist.name}</a>
                      : <PrimaryButton disabled>No therapist email on file</PrimaryButton>}
                    <SecondaryButton onClick={exportPdf} disabled={pdfBusy}>{pdfBusy ? 'Preparing…' : '⬇ Export report (PDF)'}</SecondaryButton>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent sessions */}
            <div style={CARD}>
              <CardTitle right={data.recentSessions.length > 0 && <span className="text-[12px] font-bold" style={{ color: MUTED }}>{data.recentSessions.length} most recent</span>}>Recent sessions</CardTitle>
              {data.recentSessions.length === 0 ? <p className="text-[13px]" style={{ color: MUTED }}>No sessions recorded yet.</p> : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[600px] border-collapse">
                      <thead>
                        <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MUTED }}>
                          {['Date', 'Game', 'Therapy type', 'Accuracy', 'Hints', 'Minutes', 'XP earned'].map((h) => <th key={h} scope="col" className="pb-2 pr-3">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsPage.map((s, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}>
                            <td className="py-2.5 pr-3 text-[13px]" style={{ color: MUTED }}>{fmtDate(s.date, false)}</td>
                            <td className="py-2.5 pr-3 text-[13px] font-bold" style={{ color: GREEN_900 }}>{s.game}</td>
                            <td className="py-2.5 pr-3 text-[13px]" style={{ color: GREEN_900 }}>{s.therapyType || '—'}</td>
                            <td className="py-2.5 pr-3 text-[13px]" style={{ color: GREEN_900 }}>{s.accuracy !== null ? `${s.accuracy}%` : '—'}</td>
                            <td className="py-2.5 pr-3 text-[13px]" style={{ color: GREEN_900 }}>{s.hints}</td>
                            <td className="py-2.5 pr-3 text-[13px]" style={{ color: GREEN_900 }}>{s.minutes}</td>
                            <td className="py-2.5 text-[13px] font-bold" style={{ color: '#16a34a' }}>+{s.xp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="flex flex-col gap-2.5 md:hidden" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {sessionsPage.map((s, i) => (
                      <li key={i} className="rounded-xl p-3" style={{ border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-extrabold" style={{ color: GREEN_900 }}>{s.game}</span>
                          <span className="text-[12px]" style={{ color: MUTED }}>{fmtDate(s.date, false)}</span>
                        </div>
                        <p className="text-[12.5px]" style={{ color: MUTED, margin: '4px 0 0' }}>
                          {s.therapyType || '—'} · {s.accuracy !== null ? `${s.accuracy}%` : '—'} accuracy · {s.hints} hint{s.hints === 1 ? '' : 's'} · {s.minutes} min · <span style={{ color: '#16a34a', fontWeight: 700 }}>+{s.xp} XP</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                  {sessionsPage.length < data.recentSessions.length && (
                    <div className="mt-3 flex justify-center"><SecondaryButton onClick={() => setPage((p) => p + 1)}>Show more</SecondaryButton></div>
                  )}
                </>
              )}
            </div>

            <p className="text-center text-[11.5px]" style={{ color: MUTED }}>Descriptive summary of recorded sessions. It does not diagnose or predict.</p>
          </div>
        )}
      </div>
    </OwnerPageShell>
  )
}
