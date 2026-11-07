import { useState } from 'react'
import { AMBER_BG, AMBER_FG, Btn, BORDER, CARD, ChartCard, Chip, DataTable, GREEN_900, HOME, LegendDot, MUTED, PaoNote, SegmentedTabs, THERAPY } from './stats/ui'
import { DayLines, GroupedBars, GroupedTable, dayLabel } from './stats/charts'

// "Home practice vs therapy sessions": one card with three tabs.
//   Overview  goal cards, empty state (fewer than 3 home plays), therapy-vs-home table, how each game went
//   By game   one card per game, therapy and home side by side
//   Trends    accuracy over time, mistakes per play, plays per week, XP per week, character stat points
// Descriptive only: what was recorded and how the two settings compare. No prediction, no diagnosis.
// Data: the `homePractice` object built by api/_lib/homePracticeStats.js.
// The page owns the tab (kept in the URL as ?tab=) and the two actions; both are optional so the component also renders alone.
export const HOME_TABS = [{ id: 'overview', label: 'Overview' }, { id: 'by-game', label: 'By game' }, { id: 'trends', label: 'Trends' }]
const GAME_COLORS = ['#1FA48C', '#F59E0B', '#4A90D9', '#EC4899', '#7B5BE0', '#14B8A6', '#94A3B8']
const GAME_ICON = { 'Money Match': '🪙', 'Copy the Colors': '🎨', 'Sort the Basket': '🧺' }
const STATS = [['intelligence', 'Intelligence'], ['focus', 'Focus'], ['resistance', 'Resistance'], ['creativity', 'Creativity'], ['speed', 'Speed'], ['memory', 'Memory']]
const PAO_LOOK_DOWN = '/pao/png/pao-think.png' // no "look down" pose exists in the repo; this is the closest existing one
const SERIES = [{ key: 'a', label: 'Therapy sessions', color: THERAPY }, { key: 'b', label: 'Home practice', color: HOME }]

const dash = '—'
const num = (v, unit = '') => (v == null ? dash : `${v}${unit}`)
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dash)
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
function diff(home, session, unit = '', lowerIsBetter = false) {
  if (home == null || session == null) return dash
  const d = Math.round((home - session) * 10) / 10
  if (d === 0) return 'same'
  const good = lowerIsBetter ? d < 0 : d > 0
  return <span style={{ color: good ? '#17613A' : AMBER_FG }}>{d > 0 ? '+' : ''}{d}{unit}</span> // never red: a lower number is not an alarm
}
// Zero values are greyed out; a missing value is a dash.
const cell = (v, color) => (v == null ? <span style={{ color: MUTED }}>{dash}</span> : <span style={{ color: v === 0 || v === '0' ? '#9AB0A8' : color }}>{v}</span>)

function Warning({ children }) {
  return <p role="note" className="mt-3" style={{ background: '#FDEEEE', color: '#8F1F1F', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontWeight: 700, margin: 0 }}><span aria-hidden="true">⚠ </span>{children}</p>
}
function Note({ children }) { return <p style={{ background: AMBER_BG, color: AMBER_FG, borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 700, margin: '12px 0 0', display: 'inline-block' }}>{children}</p> }

// "Needs another try": over 2 mistakes per play, or accuracy under 60%.
function struggle(g) {
  const plays = g.home.plays + g.session.plays
  if (!plays) return null
  const mistakes = g.home.mistakes + g.session.mistakes
  const attempts = ['home', 'session'].reduce((a, k) => a + (g[k].accuracy == null ? 0 : 1), 0)
  const accs = ['home', 'session'].map((k) => g[k].accuracy).filter((v) => v != null)
  const lowAcc = attempts && Math.min(...accs) < 60
  const perPlay = mistakes / plays
  if (!(perPlay > 2 || lowAcc)) return null
  return { mistakes, plays, perPlay: Math.round(perPlay * 10) / 10 }
}
const bestAcc = (g) => (g.session.accuracy ?? g.home.accuracy)

export default function HomePracticeStats({ data, firstName = 'This child', tab: tabProp, onTabChange, onRemind, onEditPlan }) {
  const [tabState, setTabState] = useState('overview')
  const [game, setGame] = useState('all')
  const [remindMsg, setRemindMsg] = useState('')
  const [reminding, setReminding] = useState(false)
  if (!data) return null
  const tab = HOME_TABS.some((t) => t.id === tabProp) ? tabProp : tabState
  const setTab = (id) => { setTabState(id); onTabChange?.(id) }
  const { totals, comparison, perGame, weeklyPlays, accuracySeries, xpByWeek, plan, hasPlan, minHomePlays, dayKeys } = data
  const h = totals.home, s = totals.session
  const games = perGame.filter((g) => g.assigned || g.home.plays > 0)
  const goal = plan?.goalPerGamePerWeek
  const lastWeek = weeklyPlays[weeklyPlays.length - 1]
  const idx = (g) => perGame.indexOf(g)
  const color = (g) => GAME_COLORS[idx(g) % GAME_COLORS.length]
  const thisWeek = (g) => lastWeek?.byGame.find((x) => x.gameId === g.gameId)?.count ?? 0

  const remind = async () => {
    if (!onRemind || reminding) return
    setReminding(true); setRemindMsg('')
    try { setRemindMsg(await onRemind()) } catch (e) { setRemindMsg(e.message || 'Could not send the reminder.') } finally { setReminding(false) }
  }
  const actions = (
    <>
      {onRemind && <Btn primary onClick={remind} disabled={reminding}>{reminding ? 'Sending…' : 'Send a reminder'}</Btn>}
      {onEditPlan && <Btn onClick={onEditPlan}>Edit home plan</Btn>}
    </>
  )
  const status = remindMsg ? <p role="status" style={{ fontSize: 14, fontWeight: 700, color: GREEN_900, margin: '10px 0 0' }}>{remindMsg}</p> : null

  const head = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <h3 style={{ fontSize: 22, fontWeight: 700, color: GREEN_900, margin: 0 }}>Home practice vs therapy sessions</h3>
        <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 0' }}>
          {hasPlan && plan.games.length ? `Games sent home: ${plan.games.map((g) => g.name).join(', ')}${goal ? ` · goal ${goal}× per game each week` : ''}` : 'Plays recorded at home in this period'}
        </p>
      </div>
      {(hasPlan || h.plays > 0) && <SegmentedTabs tabs={HOME_TABS} value={tab} onChange={setTab} label="Home practice sections" />}
    </div>
  )

  if (!hasPlan && h.plays === 0) {
    return (
      <section style={CARD} aria-label="Home practice versus therapy sessions">
        {head}
        <div className="mt-4"><PaoNote src={PAO_LOOK_DOWN} title="No home practice yet" actions={onEditPlan ? <Btn primary onClick={onEditPlan}>Send games home</Btn> : null}>
          No home practice plan was active in this period. When you send games home from a finished session, how often {firstName} plays them, the mistakes, and the XP and stats earned will be compared here.
        </PaoNote></div>
      </section>
    )
  }

  /* ── Overview ── */
  const overview = (
    <div className="grid grid-cols-1 gap-5">
      {hasPlan && plan.games.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-3">
          {games.filter((g) => g.assigned).map((g) => {
            const n = thisWeek(g)
            return (
              <div key={g.gameId} style={{ border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, minWidth: 0 }}>
                <p className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: GREEN_900, margin: 0 }}><span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: color(g), display: 'inline-block' }} />{g.name}</p>
                <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 16, fontWeight: 700 }}><span style={{ fontSize: 32, color: GREEN_900 }}>{n}</span> {goal ? `of ${goal} this week` : 'this week'}</p>
                <div role="progressbar" aria-label={`${g.name} plays this week`} aria-valuemin={0} aria-valuemax={goal || n} aria-valuenow={n} style={{ height: 8, borderRadius: 99, background: '#E8EFEC', marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${goal ? Math.min(100, (n / goal) * 100) : n ? 100 : 0}%`, height: '100%', background: color(g) }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {h.plays < minHomePlays ? (
        <div>
          <PaoNote src={PAO_LOOK_DOWN} title={h.plays === 0 ? 'No home plays yet' : 'Not enough home plays yet'} actions={actions}>
            We need at least {minHomePlays} home plays (so far {h.plays}) and 1 therapy play to compare fairly. {firstName} has finished {plural(s.plays, 'therapy play')}.
          </PaoNote>
          {status}
        </div>
      ) : (
        <div role="status" style={{ background: '#E3F6EA', color: '#17613A', borderRadius: 16, padding: '14px 18px', fontSize: 15, lineHeight: 1.5 }}>{comparison.text}</div>
      )}

      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section style={{ ...CARD, padding: 22 }} aria-label="Therapy sessions vs home practice">
          <h4 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Therapy sessions vs home practice</h4>
          <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 12px' }}>Everything recorded in the selected period</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontSize: 14, minWidth: 440 }}>
              <caption className="sr-only">Therapy sessions compared with home practice</caption>
              <thead>
                <tr style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                  <th scope="col" className="pb-2 pr-3" style={{ textAlign: 'left', color: MUTED }}>Measure</th>
                  <th scope="col" className="pb-2 pr-3" style={{ color: THERAPY, whiteSpace: 'nowrap' }}>● Therapy</th>
                  <th scope="col" className="pb-2 pr-3" style={{ color: HOME, whiteSpace: 'nowrap' }}>● Home</th>
                  <th scope="col" className="pb-2" style={{ color: MUTED, whiteSpace: 'nowrap' }}>Diff.</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Plays (games finished)', s.plays, h.plays, diff(h.plays, s.plays)],
                  ['Accuracy', num(s.accuracy, '%'), num(h.accuracy, '%'), diff(h.accuracy, s.accuracy, ' pts')],
                  ['Mistakes (total)', s.mistakes, h.mistakes, dash],
                  ['Mistakes per play', num(s.mistakesPerPlay), num(h.mistakesPerPlay), diff(h.mistakesPerPlay, s.mistakesPerPlay, '', true)],
                  ['Perfect finishes (no mistakes, no hints)', `${s.perfect}${s.perfectRate != null ? ` (${s.perfectRate}%)` : ''}`, `${h.perfect}${h.perfectRate != null ? ` (${h.perfectRate}%)` : ''}`, diff(h.perfectRate, s.perfectRate, ' pts')],
                  ['Mastered plays (100% accuracy)', `${s.mastered}${s.masteredRate != null ? ` (${s.masteredRate}%)` : ''}`, `${h.mastered}${h.masteredRate != null ? ` (${h.masteredRate}%)` : ''}`, diff(h.masteredRate, s.masteredRate, ' pts')],
                  ['Hints per play', num(s.hintsPerPlay), num(h.hintsPerPlay), diff(h.hintsPerPlay, s.hintsPerPlay, '', true)],
                  ['Minutes played', s.minutes, h.minutes, dash],
                  ['XP earned', s.xp, h.xp, dash],
                  ['Character stat points', s.statsTotal, h.statsTotal, dash],
                ].map((r) => (
                  <tr key={r[0]} style={{ borderTop: '1px solid #EDF2F0' }}>
                    <th scope="row" className="py-2.5 pr-3" style={{ textAlign: 'left', fontWeight: 700, color: GREEN_900 }}>{r[0]}</th>
                    <td className="py-2.5 pr-3" style={{ textAlign: 'right', fontWeight: 800 }}>{cell(r[1], THERAPY)}</td>
                    <td className="py-2.5 pr-3" style={{ textAlign: 'right', fontWeight: 800 }}>{cell(r[2], HOME)}</td>
                    <td className="py-2.5" style={{ textAlign: 'right', color: MUTED, fontWeight: 700 }}>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 14, color: MUTED, margin: '12px 0 0', lineHeight: 1.45 }}>Mistakes = tries that were not right. Accuracy = correct ÷ attempts across all plays. Home plays always earn XP and stats; badges and clothes are given only the first time a game is finished.</p>
        </section>

        <section style={{ ...CARD, padding: 22 }} aria-label="How each game went">
          <h4 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>How each game went</h4>
          <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 12px' }}>Therapy vs home, per game</p>
          <ul className="grid grid-cols-1 gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {games.map((g) => {
              const acc = bestAcc(g)
              const hard = struggle(g)
              return (
                <li key={g.gameId} style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 16, fontWeight: 700, color: GREEN_900 }}>{g.name}</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: acc == null ? MUTED : acc >= 80 ? '#17803D' : acc < 60 ? '#D63A73' : GREEN_900 }}>{num(acc, '%')}</span>
                  </div>
                  <div role="progressbar" aria-label={`${g.name} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={acc ?? 0} style={{ height: 8, borderRadius: 99, background: '#E8EFEC', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${acc ?? 0}%`, height: '100%', background: acc != null && acc < 60 ? '#E0457B' : '#17803D' }} />
                  </div>
                  <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Session plays {g.session.plays} · Home plays {g.home.plays} · Mistakes {g.session.mistakes + g.home.mistakes} · {g.session.minutes + g.home.minutes} min</p>
                  {hard && hard.perPlay > 2 && <Warning>Needs another try · {plural(hard.mistakes, 'mistake')}</Warning>}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )

  /* ── By game ── */
  const shown = game === 'all' ? games : games.filter((g) => g.gameId === game)
  const byGame = (
    <div className="grid grid-cols-1 gap-4">
      <div role="group" aria-label="Filter by game" className="flex flex-wrap gap-2">
        {[{ gameId: 'all', name: 'All games' }, ...games].map((g) => (
          <button key={g.gameId} type="button" aria-pressed={game === g.gameId} onClick={() => setGame(g.gameId)}
            style={{ whiteSpace: 'nowrap', minHeight: 40, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: game === g.gameId ? 'none' : `1px solid ${BORDER}`, background: game === g.gameId ? '#2E5E4E' : '#fff', color: game === g.gameId ? '#fff' : GREEN_900 }}>{g.name}</button>
        ))}
      </div>
      {shown.map((g) => {
        const hard = struggle(g)
        const rows = (k, last) => [
          ['Plays', g[k].plays],
          ['Accuracy', num(g[k].accuracy, '%')],
          ['Mistakes per play', num(g[k].mistakesPerPlay)],
          ['Hints per play', num(g[k].hintsPerPlay)],
          ['Perfect finishes', g[k].perfect],
          ['Mastered plays', g[k].mastered],
          [k === 'session' ? 'Last played in therapy' : 'Last played at home', fmtDate(last)],
        ]
        const col = (k, label, tone, last) => (
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: tone, margin: '0 0 6px' }}>● {label}</p>
            <dl style={{ margin: 0 }}>
              {rows(k, last).map(([name, v]) => (
                <div key={name} className="flex items-center justify-between gap-3" style={{ borderTop: '1px solid #EDF2F0', padding: '8px 0', fontSize: 14 }}>
                  <dt style={{ color: MUTED }}>{name}</dt>
                  <dd style={{ margin: 0, fontWeight: 800, color: v === 0 || v === '0' || v === dash ? '#9AB0A8' : GREEN_900, textAlign: 'right' }}>{v}</dd>
                </div>
              ))}
            </dl>
            {k === 'home' && g.home.plays === 0 && <p style={{ background: '#F1F5F3', color: MUTED, borderRadius: 12, padding: '8px 12px', fontSize: 14, fontWeight: 700, margin: '10px 0 0' }}>No home plays yet{goal ? ` · goal is ${goal} per week` : ''}</p>}
          </div>
        )
        const acc = bestAcc(g)
        return (
          <section key={g.gameId} style={{ ...CARD, padding: 22 }} aria-label={g.name}>
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: '#EAF4EF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{GAME_ICON[g.name] || '🎮'}</span>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <h4 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>{g.name}</h4>
                <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Therapy: {g.session.minutes} min · Home: {g.home.plays ? `${g.home.minutes} min` : 'not played yet'}</p>
              </div>
              {g.assigned && goal ? <Chip bg={AMBER_BG} fg={AMBER_FG}>Goal this week: {thisWeek(g)} of {goal}</Chip> : null}
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED, margin: 0 }}>Therapy accuracy</p>
                <p style={{ fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1.1, color: acc == null ? MUTED : acc >= 80 ? '#17803D' : acc < 60 ? '#D63A73' : GREEN_900 }}>{num(g.session.accuracy, '%')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {col('session', 'Therapy sessions', THERAPY, g.lastSessionAt)}
              {col('home', 'Home practice', HOME, g.lastHomeAt)}
            </div>
            {hard && <Warning>Needs another try: {plural(hard.mistakes, 'mistake')} in {plural(hard.plays, 'play')}. Consider repeating it in the next session.</Warning>}
          </section>
        )
      })}
      {shown.length === 0 && <p style={{ color: MUTED, fontSize: 15 }}>No games to show yet.</p>}
    </div>
  )

  /* ── Trends ── */
  const allDays = [...new Set([...accuracySeries.home, ...accuracySeries.session].map((p) => p.date))].sort()
  const playDays = new Set([...accuracySeries.home, ...accuracySeries.session].map((p) => p.date)).size
  const days = dayKeys?.length ? dayKeys : allDays
  const trendText = (() => {
    if (h.plays === 0) {
      if (s.plays === 0) return 'No plays were recorded in this period yet.'
      const when = allDays.length === 1 ? ` on ${dayLabel(allDays[0])}` : ''
      return `All of ${firstName}'s ${plural(s.plays, 'play')} happened in therapy${when}. Home plays are 0, so nothing can be compared yet.`
    }
    return comparison.text
  })()
  const legend = <>{SERIES.map((x) => <LegendDot key={x.key} color={x.color} label={x.label} />)}</>
  const cats = games.map((g) => ({ label: g.name }))
  const mistakeVals = games.map((g) => ({ a: g.session.plays ? g.session.mistakesPerPlay : 0, b: g.home.plays ? g.home.mistakesPerPlay : 0 }))
  const wkCats = weeklyPlays.map((w) => ({ label: w.label }))
  const wkSeries = games.map((g) => ({ key: g.gameId, label: g.name, color: color(g) }))
  const wkVals = weeklyPlays.map((w) => Object.fromEntries(w.byGame.map((b) => [b.gameId, b.count])))
  const goalTotal = weeklyPlays[0]?.goalTotal || null
  const xpCats = xpByWeek.map((w) => ({ label: w.label }))
  const xpVals = xpByWeek.map((w) => ({ a: w.sessionXp, b: w.homeXp }))
  const statCats = STATS.map(([, label]) => ({ label }))
  const statVals = STATS.map(([k]) => ({ a: s.stats[k], b: h.stats[k] }))
  const dayRows = days.map((d) => {
    const pick = (list) => { const v = list.filter((p) => p.date === d).map((p) => p.value); return v.length ? `${Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10}%` : dash }
    return [dayLabel(d), pick(accuracySeries.session), pick(accuracySeries.home)]
  })
  const trends = (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <PaoNote tone="blue" src={PAO_LOOK_DOWN} eyebrow="What the trends show" actions={onRemind ? <Btn primary onClick={remind} disabled={reminding}>{reminding ? 'Sending…' : 'Send a reminder'}</Btn> : null}>{trendText}</PaoNote>
        {status}
      </div>
      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-2">
        <ChartCard title="Accuracy over time" subtitle="Each day with plays · home vs therapy" legend={legend}
          chart={<DayLines days={days} home={accuracySeries.home} session={accuracySeries.session} />}
          table={<DataTable caption="Accuracy by day" head={['Day', 'Therapy sessions', 'Home practice']} rows={dayRows} />}
          note={playDays < 3 ? <Note>Only {plural(playDays, 'day')} {playDays === 1 ? 'has' : 'have'} plays so far</Note> : null} />
        <ChartCard title="Mistakes per play, by game" subtitle="Fewer mistakes means the game is going smoothly" legend={legend}
          chart={<GroupedBars caption="Mistakes per play by game" categories={cats} series={SERIES} values={mistakeVals} />}
          table={<GroupedTable caption="Mistakes per play by game" first="Game" categories={cats} series={SERIES} values={mistakeVals} />} />
        <ChartCard title="How often the games were played at home" subtitle={`Home plays per week, by game${goal ? ` · goal ${goal}× per game each week` : ''}`}
          legend={<>{wkSeries.map((x) => <LegendDot key={x.key} color={x.color} label={x.label} />)}</>}
          chart={<GroupedBars caption="Home plays per week by game" categories={wkCats} series={wkSeries} values={wkVals} goal={goalTotal} goalLabel={`Weekly goal ${goalTotal}`} decimals={0} />}
          table={<GroupedTable caption="Home plays per week by game" first="Week" categories={wkCats} series={wkSeries} values={wkVals} decimals={0} />}
          note={h.plays === 0 ? <Note>No home plays recorded yet</Note> : null} />
        <ChartCard title="XP earned per week" subtitle="Replays keep earning XP and stats" legend={legend}
          chart={<GroupedBars caption="XP earned per week" categories={xpCats} series={SERIES} values={xpVals} decimals={0} />}
          table={<GroupedTable caption="XP earned per week" first="Week" categories={xpCats} series={SERIES} values={xpVals} decimals={0} />} />
      </div>
      <ChartCard title="Character stat points gained" subtitle="Home practice vs therapy sessions" legend={legend}
        chart={<GroupedBars caption="Character stat points gained" categories={statCats} series={SERIES} values={statVals} decimals={0} />}
        table={<GroupedTable caption="Character stat points gained" first="Stat" categories={statCats} series={SERIES} values={statVals} decimals={0} />} />
    </div>
  )

  return (
    <section style={CARD} aria-label="Home practice versus therapy sessions">
      {head}
      <div className="mt-5" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'by-game' ? byGame : tab === 'trends' ? trends : overview}
      </div>
    </section>
  )
}
