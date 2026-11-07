import { useState } from 'react'

// "Home practice vs therapy sessions" section of the therapist's Patient Stats page.
// Descriptive only (what was recorded and how the two settings compare); no prediction, no diagnosis.
// Data: the `homePractice` object built by api/_lib/homePracticeStats.js.
//
//   1. comparison banner      better at home / about the same / lower at home / not enough data
//   2. side-by-side table     plays, accuracy, mistakes, perfect finishes, mastered, hints, XP, character stats
//   3. home plays per week    stacked by assigned game, with the weekly goal
//   4. per-game table         plays at home vs the goal, and how each game went at home vs in sessions
//   5. accuracy over time     home vs therapy lines
//   6. mistakes per play      by game, home vs therapy
//   7. XP and character stats earned at home vs in sessions (graphs + table)
// Every chart has a "View as table" switch and a text description for screen readers.

const GREEN_900 = '#1F3D36'
const GREEN_700 = '#234C40'
const MUTED = '#5D7770'
const BORDER = '#E3E8E4'
const CARD = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 20 }
const HOME = '#1FA58A'
const SESSION = '#7C5CE0'
const GAME_COLORS = ['#1FA58A', '#F59E0B', '#4A90D9', '#EC4899', '#7C5CE0', '#14B8A6', '#94A3B8']
const STATS = [['intelligence', 'Intelligence', '🧠'], ['focus', 'Focus', '🎯'], ['resistance', 'Resistance', '🛡️'], ['creativity', 'Creativity', '🎨'], ['speed', 'Speed', '⚡'], ['memory', 'Memory', '💭']]
const VERDICT = {
  better_at_home: { label: 'Better at home', bg: '#E3F6EA', fg: '#17613A', icon: '📈' },
  similar: { label: 'About the same', bg: '#F1F5F3', fg: '#3F5A52', icon: '⚖️' },
  lower_at_home: { label: 'Lower at home', bg: '#FFF3D9', fg: '#8A5A0B', icon: '📉' },
  not_enough_data: { label: 'Not enough data yet', bg: '#F1F5F3', fg: '#5D7770', icon: '⏳' },
}

const num = (v, unit = '') => (v == null ? '—' : `${v}${unit}`)
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
const dayLabel = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
function diff(home, session, unit = '', lowerIsBetter = false) {
  if (home == null || session == null) return { text: '—', tone: MUTED }
  const d = Math.round((home - session) * 10) / 10
  if (d === 0) return { text: 'same', tone: MUTED }
  const good = lowerIsBetter ? d < 0 : d > 0
  return { text: `${d > 0 ? '+' : ''}${d}${unit}`, tone: good ? '#17613A' : '#8A5A0B' } // never red: a lower number is not an alarm
}

function Section({ title, subtitle, children, right }) {
  return (
    <section style={CARD} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: GREEN_900, margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 12.5, color: MUTED, margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function Legend({ items }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: GREEN_900 }}>
          <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: it.color, display: 'inline-block' }} />{it.label}
        </span>
      ))}
    </div>
  )
}

function DataTable({ caption, head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr style={{ color: MUTED, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {head.map((h, i) => <th key={h} scope="col" className="pb-2 pr-3" style={{ textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}>
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-3" style={{ textAlign: j === 0 ? 'left' : 'right', color: c && typeof c === 'object' ? c.tone : GREEN_900, fontWeight: j === 0 ? 700 : 500 }}>{c && typeof c === 'object' ? c.text : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A chart with its table twin: "View as table" swaps the drawing for the numbers.
function Switchable({ chart, table }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <div>
      {asTable ? table : chart}
      <button type="button" onClick={() => setAsTable((v) => !v)} className="mt-1 text-[12px] font-bold" style={{ color: GREEN_700, minHeight: 44 }}>{asTable ? '← Back to chart' : 'View as table'}</button>
    </div>
  )
}

/* ── chart pieces (plain SVG, same look as the other charts on the page) ── */
const W = 720, H = 220, PL = 40, PR = 12, PT = 12, PB = 30

function Axis({ top, unit = '', ticks = 4 }) {
  const inner = H - PT - PB
  return [...Array(ticks + 1)].map((_, i) => {
    const v = (top / ticks) * i
    const y = PT + inner - (v / top) * inner
    return (
      <g key={i}>
        <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="#EEF2F0" />
        <text x={PL - 6} y={y + 3} fontSize="10" textAnchor="end" fill={MUTED}>{Number.isInteger(v) ? v : v.toFixed(1)}{unit}</text>
      </g>
    )
  })
}

// Accuracy of each play, one line for home and one for therapy (days with several plays are averaged).
function AccuracyLines({ home, session }) {
  const byDay = (pts) => { const m = new Map(); pts.forEach((p) => { const a = m.get(p.date) || []; a.push(p.value); m.set(p.date, a) }); return new Map([...m].map(([k, v]) => [k, Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 10) / 10])) }
  const h = byDay(home), s = byDay(session)
  const days = [...new Set([...h.keys(), ...s.keys()])].sort()
  if (!days.length) return <p className="py-8 text-center text-[13px]" style={{ color: MUTED }}>No plays with a score in this period.</p>
  const inner = { w: W - PL - PR, h: H - PT - PB }
  const x = (i) => PL + (days.length > 1 ? (inner.w * i) / (days.length - 1) : inner.w / 2)
  const y = (v) => PT + inner.h - (v / 100) * inner.h
  const path = (m) => days.map((d, i) => (m.has(d) ? { x: x(i), y: y(m.get(d)), v: m.get(d), d } : null)).filter(Boolean)
  const hp = path(h), sp = path(s)
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const every = Math.max(1, Math.ceil(days.length / 8))
  const desc = `Accuracy over time. Home practice: ${hp.map((p) => `${dayLabel(p.d)} ${p.v}%`).join(', ') || 'no plays'}. Therapy sessions: ${sp.map((p) => `${dayLabel(p.d)} ${p.v}%`).join(', ') || 'no plays'}.`
  return (
    <>
      <Switchable
        chart={(
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
            <Axis top={100} unit="%" />
            {sp.length > 0 && <path d={line(sp)} fill="none" stroke={SESSION} strokeWidth="2.2" strokeLinejoin="round" />}
            {hp.length > 0 && <path d={line(hp)} fill="none" stroke={HOME} strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="0" />}
            {sp.map((p) => <circle key={`s${p.d}`} cx={p.x} cy={p.y} r="4" fill={SESSION} stroke="#fff" strokeWidth="1.5"><title>{`Therapy session ${dayLabel(p.d)}: ${p.v}%`}</title></circle>)}
            {hp.map((p) => <rect key={`h${p.d}`} x={p.x - 4} y={p.y - 4} width="8" height="8" rx="2" fill={HOME} stroke="#fff" strokeWidth="1.5"><title>{`Home practice ${dayLabel(p.d)}: ${p.v}%`}</title></rect>)}
            {days.map((d, i) => (i % every === 0 || i === days.length - 1) && <text key={d} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill={MUTED}>{dayLabel(d)}</text>)}
          </svg>
        )}
        table={<DataTable caption="Accuracy by day, home practice and therapy sessions" head={['Day', 'Therapy sessions', 'Home practice']} rows={days.map((d) => [dayLabel(d), s.has(d) ? `${s.get(d)}%` : '—', h.has(d) ? `${h.get(d)}%` : '—'])} />}
      />
    </>
  )
}

// Home plays per week, stacked by assigned game; the dashed line is the weekly goal for all games together.
function WeeklyPlays({ weeks, games, goalTotal }) {
  const top = Math.max(4, goalTotal || 0, ...weeks.map((w) => w.total))
  const topR = Math.ceil(top / 4) * 4
  const inner = { w: W - PL - PR, h: H - PT - PB }
  const slot = inner.w / Math.max(1, weeks.length)
  const bw = Math.min(54, slot * 0.6)
  const y = (v) => PT + inner.h - (v / topR) * inner.h
  const desc = `Home plays per week: ${weeks.map((w) => `${w.label} ${w.total}`).join(', ')}.${goalTotal ? ` Weekly goal ${goalTotal} plays in total.` : ''}`
  return (
    <Switchable
      chart={(
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          <Axis top={topR} />
          {weeks.map((w, i) => {
            let acc = 0
            const cx = PL + slot * i + slot / 2
            return (
              <g key={w.weekStart}>
                {w.byGame.map((g, gi) => {
                  if (!g.count) return null
                  const y0 = y(acc + g.count), h = y(acc) - y0
                  acc += g.count
                  return <rect key={g.gameId} x={cx - bw / 2} y={y0} width={bw} height={h} fill={GAME_COLORS[gi % GAME_COLORS.length]} rx="2"><title>{`${games[gi]?.name}: ${g.count} home play${g.count === 1 ? '' : 's'} in ${w.label}`}</title></rect>
                })}
                {w.total === 0 && <rect x={cx - bw / 2} y={y(0) - 2} width={bw} height="2" fill="#E3E8E4" />}
                <text x={cx} y={y(w.total) - 5} fontSize="11" fontWeight="700" textAnchor="middle" fill={GREEN_900}>{w.total}</text>
                <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill={MUTED}>{w.label}</text>
              </g>
            )
          })}
          {goalTotal ? <g><line x1={PL} x2={W - PR} y1={y(goalTotal)} y2={y(goalTotal)} stroke="#F59E0B" strokeWidth="1.6" strokeDasharray="5 4" /><text x={W - PR} y={y(goalTotal) - 4} fontSize="10" fontWeight="700" textAnchor="end" fill="#8A5A0B">Weekly goal {goalTotal}</text></g> : null}
        </svg>
      )}
      table={<DataTable caption="Home plays per week by game" head={['Week', ...games.map((g) => g.name), 'Total']} rows={weeks.map((w) => [w.label, ...w.byGame.map((g) => g.count), w.total])} />}
    />
  )
}

// Two bars per category (home vs therapy).
function PairedBars({ rows, unit = '', caption, aLabel = 'Therapy sessions', bLabel = 'Home practice', decimals = 1 }) {
  const top = Math.max(1, ...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]))
  const topR = unit === '%' ? 100 : (top <= 4 ? Math.ceil(top) || 1 : Math.ceil(top / 4) * 4)
  const inner = { w: W - PL - PR, h: H - PT - PB }
  const slot = inner.w / Math.max(1, rows.length)
  const bw = Math.min(30, slot * 0.28)
  const y = (v) => PT + inner.h - (Math.min(topR, v) / topR) * inner.h
  const fmt = (v) => (v == null ? '—' : `${Number.isInteger(v) ? v : v.toFixed(decimals)}${unit}`)
  const desc = `${caption}: ${rows.map((r) => `${r.label}, ${aLabel} ${fmt(r.a)}, ${bLabel} ${fmt(r.b)}`).join('; ')}.`
  return (
    <Switchable
      chart={(
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          <Axis top={topR} unit={unit} ticks={4} />
          {rows.map((r, i) => {
            const cx = PL + slot * i + slot / 2
            return (
              <g key={r.label}>
                {r.a != null && <rect x={cx - bw - 2} y={y(r.a)} width={bw} height={Math.max(1, y(0) - y(r.a))} fill={SESSION} rx="2"><title>{`${r.label} · ${aLabel}: ${fmt(r.a)}`}</title></rect>}
                {r.b != null && <rect x={cx + 2} y={y(r.b)} width={bw} height={Math.max(1, y(0) - y(r.b))} fill={HOME} rx="2"><title>{`${r.label} · ${bLabel}: ${fmt(r.b)}`}</title></rect>}
                {r.a != null && <text x={cx - bw / 2 - 2} y={y(r.a) - 4} fontSize="10" fontWeight="700" textAnchor="middle" fill={GREEN_900}>{fmt(r.a)}</text>}
                {r.b != null && <text x={cx + bw / 2 + 2} y={y(r.b) - 4} fontSize="10" fontWeight="700" textAnchor="middle" fill={GREEN_900}>{fmt(r.b)}</text>}
                <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill={MUTED}>{r.label.length > 16 ? `${r.label.slice(0, 15)}…` : r.label}</text>
              </g>
            )
          })}
        </svg>
      )}
      table={<DataTable caption={caption} head={['', aLabel, bLabel]} rows={rows.map((r) => [r.label, fmt(r.a), fmt(r.b)])} />}
    />
  )
}

export default function HomePracticeStats({ data, firstName = 'This child' }) {
  if (!data) return null
  const { totals, comparison, perGame, weeklyPlays, accuracySeries, xpByWeek, plan, hasPlan, minHomePlays } = data
  const h = totals.home, s = totals.session
  const v = VERDICT[comparison.verdict] || VERDICT.not_enough_data
  const games = perGame.filter((g) => g.assigned || g.home.plays > 0)
  const goal = plan?.goalPerGamePerWeek
  const lastWeek = weeklyPlays[weeklyPlays.length - 1]

  if (!hasPlan && h.plays === 0) {
    return (
      <Section title="Home practice vs therapy sessions" subtitle="How the games sent home compare with the games played in sessions">
        <p className="text-[13.5px]" style={{ color: MUTED }}>No home practice plan was active in this period. When you send games home from a finished session, how often {firstName} plays them, the mistakes, and the XP and stats earned will be compared here.</p>
      </Section>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5" aria-label="Home practice versus therapy sessions">
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Home practice vs therapy sessions</h2>
        <p style={{ fontSize: 13, color: MUTED, margin: '2px 0 0' }}>
          {hasPlan && plan.games.length ? `Games sent home: ${plan.games.map((g) => g.name).join(', ')}${goal ? ` · goal ${goal}× per game each week` : ''}.` : 'Plays recorded at home in this period.'} Descriptive summary of recorded plays only.
        </p>
      </div>

      {/* 1. comparison banner */}
      <div role="status" className="flex flex-wrap items-start gap-3 rounded-2xl p-4" style={{ background: v.bg, color: v.fg }}>
        <span aria-hidden="true" style={{ fontSize: 24 }}>{v.icon}</span>
        <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{v.label}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13.5, lineHeight: 1.5 }}>{comparison.text}</p>
          {comparison.verdict === 'not_enough_data' && <p style={{ margin: '4px 0 0', fontSize: 12 }}>A fair comparison needs at least {minHomePlays} plays at home and one in a therapy session.</p>}
        </div>
      </div>

      {/* 2. side-by-side table */}
      <Section title="Therapy sessions vs home practice" subtitle="Everything recorded in the selected period">
        <DataTable
          caption="Therapy sessions compared with home practice"
          head={['Measure', 'Therapy sessions', 'Home practice', 'Difference']}
          rows={[
            ['Plays (games finished)', s.plays, h.plays, diff(h.plays, s.plays)],
            ['Accuracy', num(s.accuracy, '%'), num(h.accuracy, '%'), diff(h.accuracy, s.accuracy, ' pts')],
            ['Mistakes (total)', s.mistakes, h.mistakes, '—'],
            ['Mistakes per play', num(s.mistakesPerPlay), num(h.mistakesPerPlay), diff(h.mistakesPerPlay, s.mistakesPerPlay, '', true)],
            ['Perfect finishes (no mistakes, no hints)', `${s.perfect}${s.perfectRate != null ? ` (${s.perfectRate}%)` : ''}`, `${h.perfect}${h.perfectRate != null ? ` (${h.perfectRate}%)` : ''}`, diff(h.perfectRate, s.perfectRate, ' pts')],
            ['Mastered plays (100% accuracy)', `${s.mastered}${s.masteredRate != null ? ` (${s.masteredRate}%)` : ''}`, `${h.mastered}${h.masteredRate != null ? ` (${h.masteredRate}%)` : ''}`, diff(h.masteredRate, s.masteredRate, ' pts')],
            ['Hints per play', num(s.hintsPerPlay), num(h.hintsPerPlay), diff(h.hintsPerPlay, s.hintsPerPlay, '', true)],
            ['Minutes played', s.minutes, h.minutes, '—'],
            ['XP earned', s.xp, h.xp, '—'],
            ['Character stat points gained', s.statsTotal, h.statsTotal, '—'],
          ]}
        />
        <p className="mt-3 text-[11.5px]" style={{ color: MUTED }}>Mistakes = tries that were not right (attempts − correct). Accuracy = correct ÷ attempts across all plays. Home plays still earn XP and character stats every time; badges and clothes are only given the first time a game is finished.</p>
      </Section>

      {/* 3. weekly plays */}
      <Section title="How often the games were played at home" subtitle={`Home plays per week, by game${goal ? `. Goal: ${goal}× per game each week.` : '.'}`}>
        <Legend items={games.map((g, i) => ({ label: g.name, color: GAME_COLORS[perGame.indexOf(g) % GAME_COLORS.length] }))} />
        <WeeklyPlays weeks={weeklyPlays} games={perGame} goalTotal={weeklyPlays[0]?.goalTotal || null} />
        <div className="mt-3">
          <DataTable
            caption="Plays at home for each assigned game"
            head={['Game', 'Plays at home', goal ? `This week (goal ${goal})` : 'This week', 'Average per week', 'Last played at home', 'Perfect finishes', 'Mastered']}
            rows={games.map((g) => {
              const wk = lastWeek?.byGame.find((x) => x.gameId === g.gameId)?.count ?? 0
              return [g.name, g.home.plays, goal ? `${wk} of ${goal}` : wk, weeklyPlays.length ? Math.round((g.home.plays / weeklyPlays.length) * 10) / 10 : 0, fmtDate(g.lastHomeAt), g.home.perfect, g.home.mastered]
            })}
          />
        </div>
      </Section>

      {/* 4 + 5. accuracy over time and mistakes per game */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Accuracy over time" subtitle="Each day with plays; home practice vs therapy sessions">
          <Legend items={[{ label: 'Therapy sessions', color: SESSION }, { label: 'Home practice', color: HOME }]} />
          <AccuracyLines home={accuracySeries.home} session={accuracySeries.session} />
        </Section>
        <Section title="Mistakes per play, by game" subtitle="Fewer mistakes per play means the game is going more smoothly">
          <Legend items={[{ label: 'Therapy sessions', color: SESSION }, { label: 'Home practice', color: HOME }]} />
          <PairedBars caption="Mistakes per play by game" rows={games.map((g) => ({ label: g.name, a: g.session.plays ? g.session.mistakesPerPlay : null, b: g.home.plays ? g.home.mistakesPerPlay : null }))} />
        </Section>
      </div>

      {/* 6. per-game comparison table */}
      <Section title="How each game went: home vs therapy" subtitle="Perfect finishes and mastered plays show where the skill has settled">
        <DataTable
          caption="Each game, home practice compared with therapy sessions"
          head={['Game', 'Session plays', 'Home plays', 'Session accuracy', 'Home accuracy', 'Session mistakes/play', 'Home mistakes/play', 'Home perfect', 'Home mastered']}
          rows={games.map((g) => [g.name, g.session.plays, g.home.plays, num(g.session.accuracy, '%'), num(g.home.accuracy, '%'), num(g.session.mistakesPerPlay), num(g.home.mistakesPerPlay), g.home.perfect, g.home.mastered])}
        />
      </Section>

      {/* 7. XP and character stats */}
      <Section title="XP and character stats earned" subtitle="Home practice vs therapy sessions (replays keep earning XP and stats)">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <Legend items={[{ label: 'Therapy sessions', color: SESSION }, { label: 'Home practice', color: HOME }]} />
            <p className="mb-1 text-[12.5px] font-bold" style={{ color: GREEN_900 }}>XP earned per week</p>
            <PairedBars caption="XP earned per week" rows={xpByWeek.map((w) => ({ label: w.label, a: w.sessionXp, b: w.homeXp }))} decimals={0} />
          </div>
          <div>
            <Legend items={[{ label: 'Therapy sessions', color: SESSION }, { label: 'Home practice', color: HOME }]} />
            <p className="mb-1 text-[12.5px] font-bold" style={{ color: GREEN_900 }}>Character stat points gained</p>
            <PairedBars caption="Character stat points gained" rows={STATS.map(([k, label]) => ({ label, a: s.stats[k], b: h.stats[k] }))} decimals={0} />
          </div>
        </div>
        <div className="mt-3">
          <DataTable
            caption="XP and character stat points earned, therapy sessions vs home practice"
            head={['', 'Therapy sessions', 'Home practice', 'Total']}
            rows={[
              ['XP', s.xp, h.xp, s.xp + h.xp],
              ...STATS.map(([k, label, icon]) => [`${icon} ${label}`, s.stats[k], h.stats[k], s.stats[k] + h.stats[k]]),
              ['All stat points', s.statsTotal, h.statsTotal, s.statsTotal + h.statsTotal],
            ]}
          />
        </div>
      </Section>
    </div>
  )
}
