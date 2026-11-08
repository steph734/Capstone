import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../../utils/session'
import { AMBER_BG, AMBER_FG, Btn, BORDER, CARD, ChartCard, Chip, DataTable, GREEN_900, HOME, LegendDot, MUTED, PaoNote, SegmentedTabs, THERAPY } from './stats/ui'
import { DayLines, GroupedBars, GroupedTable, dayLabel } from './stats/charts'
import { HOME_TABS } from './HomePracticeStats'
import RecommendedSetModal from './assign/homeSets/RecommendedSetModal'
import './assign/homeSets/homeSets.css'

// "Home practice vs therapy sessions" that follows the home-practice SET. The server (GET /api/therapist/patients/:id/home-practice-stats)
// does all the filtering: only the selected set's games, home plays inside the set's window (max 3 per game) and the therapy plays of
// the same games around it. A new set starts from zero; the finished set stays saved and viewable. This component only renders.
// The selected set lives in the URL (?set=<id|current|all>), the tab in ?tab=. It refetches on window focus and every minute,
// so a newly assigned set shows up without a manual refresh.
const GAME_COLORS = ['#1FA48C', '#F59E0B', '#4A90D9', '#EC4899', '#7B5BE0', '#14B8A6', '#94A3B8']
const GAME_ICON = { 'Money Match': '🪙', 'Copy the Colors': '🎨', 'Sort the Basket': '🧺', 'Puzzle Pals': '🧩', 'Feed Pao': '🍙', 'Emergency Ready': '🚑' }
const STATS = [['intelligence', 'Intelligence'], ['focus', 'Focus'], ['resistance', 'Resistance'], ['creativity', 'Creativity'], ['speed', 'Speed'], ['memory', 'Memory']]
const SERIES = [{ key: 'a', label: 'Therapy sessions', color: THERAPY }, { key: 'b', label: 'Home practice', color: HOME }]
const PAO = '/games/pao-money-match-poses/pao-thumbs-up.png'
const PAO_THINK = '/pao/png/pao-think.png'
const LIMIT = 3
const dash = '—'
const num = (v, unit = '') => (v == null ? dash : `${v}${unit}`)
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : dash)
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const accTone = (v) => (v == null ? MUTED : v >= 80 ? '#17803D' : '#C2410C')
const sessionText = (s) => (s?.date ? `${new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}${s.start ? ` · ${s.start}` : ''}` : '')

function diff(home, therapy, unit = '', lowerIsBetter = false) {
  if (home == null || therapy == null) return dash
  const d = Math.round((home - therapy) * 10) / 10
  if (d === 0) return 'same'
  const good = lowerIsBetter ? d < 0 : d > 0
  return <span style={{ color: good ? '#17613A' : AMBER_FG }}>{d > 0 ? '+' : ''}{d}{unit}</span> // never red: a lower number is not an alarm
}
const cell = (v, color) => (v == null ? <span style={{ color: MUTED }}>{dash}</span> : <span style={{ color: v === 0 || v === '0' ? '#9AB0A8' : color }}>{v}</span>)

function PlayChips({ list, limit = LIMIT }) {
  return (
    <div className="hs-chips" style={{ marginBottom: 0 }}>
      {Array.from({ length: limit }, (_, i) => {
        const p = list[i]
        return (
          <span key={i} className={`hs-chip ${p ? (p.accuracy != null && p.accuracy >= 80 ? 'good' : 'low') : 'empty'}`} aria-label={p ? `Play ${i + 1}: ${p.accuracy != null ? `${p.accuracy}%` : 'no score'}` : `Play ${i + 1}: not played`}>
            <small>PLAY {i + 1}</small><b>{p && p.accuracy != null ? `${p.accuracy}%` : dash}</b>
          </span>
        )
      })}
    </div>
  )
}
const noteStyle = (tone) => (tone === 'good' ? { background: '#E3F6EA', color: '#14532D' } : tone === 'grey' ? { background: '#F1F5F3', color: MUTED } : { background: '#EEF3F0', color: GREEN_900 })

// The "SHOWING" bar: current set, latest finished set, "More sets", All sets. One radio group.
function SetSelector({ sets, selectedId, onPick }) {
  const current = sets.find((s) => s.status === 'current')
  const finished = sets.filter((s) => s.status === 'finished')
  const [latest, ...older] = finished
  const pills = [
    current && { id: current.id, param: 'current', text: `Set ${current.number} · Current`, dot: '#2F5FD0' },
    latest && { id: latest.id, param: latest.id, text: `Set ${latest.number} · Finished`, dot: '#E0A915', check: true },
    { id: 'all', param: 'all', text: 'All sets' },
  ].filter(Boolean)
  const olderPicked = older.find((s) => s.id === selectedId)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ marginTop: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.1em', color: MUTED }}>SHOWING</span>
      <div role="radiogroup" aria-label="Which set to show" className="flex flex-wrap items-center gap-2">
        {pills.map((p) => {
          const on = p.id === selectedId
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(p.param)}
              style={{ whiteSpace: 'nowrap', minHeight: 44, padding: '0 18px', borderRadius: 999, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, border: on ? 'none' : `1px solid ${BORDER}`, background: on ? '#2E5E4E' : '#fff', color: on ? '#fff' : GREEN_900 }}>
              {p.dot && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 99, background: p.dot }} />}{p.text}{p.check ? ' ✓' : ''}
            </button>
          )
        })}
        {older.length > 0 && (
          <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <span className="sr-only">More sets</span>
            <select value={olderPicked ? olderPicked.id : ''} onChange={(e) => e.target.value && onPick(e.target.value)} aria-label="More sets"
              style={{ minHeight: 44, borderRadius: 999, border: `1px solid ${olderPicked ? '#2E5E4E' : BORDER}`, background: olderPicked ? '#2E5E4E' : '#fff', color: olderPicked ? '#fff' : GREEN_900, fontSize: 15, fontWeight: 800, padding: '0 14px' }}>
              <option value="">More sets ▾</option>
              {older.map((s) => <option key={s.id} value={s.id}>Set {s.number} · {day(s.startedAt)} – {day(s.completedAt)}</option>)}
            </select>
          </label>
        )}
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 14, color: MUTED }}><span aria-hidden="true">ⓘ </span>Cards, tables and charts follow the selected set</span>
    </div>
  )
}

export default function SetStats({ patientId, range, firstName, setParam = 'current', onSetChange, tab: tabProp, onTabChange, onRemind, onEditPlan, fallback }) {
  const navigate = useNavigate()
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [tabState, setTabState] = useState('overview')
  const [game, setGame] = useState('all')
  const [recFor, setRecFor] = useState(null)
  const [msg, setMsg] = useState('')
  const [reminding, setReminding] = useState(false)
  const reqId = useRef(0)
  const key = `${patientId}|${range}|${setParam}`

  const load = useCallback(async (silent) => {
    const id = ++reqId.current
    if (!silent) { setPayload(null); setError('') }
    try {
      const d = await authFetch(`/api/therapist/patients/${patientId}/home-practice-stats`, { query: { set: setParam, range } })
      if (id === reqId.current) setPayload(d) // a slower, older request never replaces a newer one
    } catch (e) { if (id === reqId.current && !silent) setError(e.message || 'Could not load home practice.') }
  }, [patientId, range, setParam])
  useEffect(() => { load(false) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true) }, 60000)
    const vis = () => { if (!document.hidden) load(true) }
    document.addEventListener('visibilitychange', vis); window.addEventListener('focus', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', vis) }
  }, [load])
  useEffect(() => { setGame('all') }, [payload?.selected?.id])

  const tab = HOME_TABS.some((t) => t.id === tabProp) ? tabProp : tabState
  const setTab = (id) => { setTabState(id); onTabChange?.(id) }

  if (error) return <section style={CARD}><div role="alert" className="flex flex-wrap items-center justify-between gap-3" style={{ color: '#92400E', fontWeight: 700, fontSize: 15 }}><span>{error}</span><Btn primary onClick={() => load(false)}>Retry</Btn></div></section>
  if (!payload) return <section style={CARD} aria-busy="true" aria-label="Loading home practice"><div className="animate-pulse" style={{ height: 420, borderRadius: 18, background: '#E6EEEA' }} /></section>
  if (!payload.sets.length) return fallback || null // no set yet: the older range-based view with its empty state

  const { selected: sel, data, sets, prevSet, referenceAverage, insight, nextSession, homeRow, config } = payload
  const first = payload.firstName || firstName
  const { totals, comparison, perGame, accuracySeries, xpByWeek, dayKeys, minHomePlays } = data
  const h = totals.home, t = totals.session
  const games = perGame
  const isAll = sel.kind === 'all'
  const label = isAll ? 'All sets' : `Set ${sel.number}`
  const newerExists = !isAll && sets.some((s) => s.number > sel.number)
  const gameIdx = (g) => perGame.indexOf(g)
  const color = (g) => GAME_COLORS[gameIdx(g) % GAME_COLORS.length]
  const fairText = `${first} has ${plural(sel.homePlays, 'home play')} and ${plural(sel.therapyPlays, 'therapy play')}, so the comparison is ${sel.fair ? 'fair now' : 'not fair yet'}`
  const justStarted = !isAll && sel.playsUsed === 0 && sel.number > 1
  const prevOf = prevSet && !isAll ? prevSet : null
  const subtitle = isAll ? `All sets · ${games.map((g) => g.name).join(', ')} · ${LIMIT} plays per game`
    : `Set ${sel.number} · ${sel.kind === 'finished' ? `${day(sel.startedAt)} – ${day(sel.endedAt)}` : `started ${day(sel.startedAt)}`} · ${games.map((g) => g.name).join(', ')} · ${LIMIT} plays per game`

  const remind = async () => {
    if (!onRemind || reminding) return
    setReminding(true); setMsg('')
    try { setMsg(await onRemind()) } catch (e) { setMsg(e.message || 'Could not send the reminder.') } finally { setReminding(false) }
  }
  const reminderBtns = (
    <>
      {onRemind && <Btn primary onClick={remind} disabled={reminding}>{reminding ? 'Sending…' : 'Send a reminder'}</Btn>}
      {onEditPlan && <Btn onClick={onEditPlan}>Edit home plan</Btn>}
    </>
  )
  const status = msg ? <p role="status" style={{ fontSize: 14, fontWeight: 700, color: GREEN_900, margin: '10px 0 0' }}>{msg}</p> : null
  const openNotes = () => navigate(sel.soapNoteId ? `/therapist/notes-progress?patient=${payload.patientId}&draft=${sel.soapNoteId}` : `/therapist/notes-progress?patient=${payload.patientId}`)
  const canAct = Boolean(homeRow) && sel.kind === 'current' && homeRow.setId === sel.id

  /* ── Overview ── */
  const sideHas = (s) => s.plays > 0
  const row = (labelText, a, b, d) => [labelText, a, b, d]
  const tableRows = [
    row('Plays (games finished)', t.plays, h.plays, sideHas(t) && sideHas(h) ? diff(h.plays, t.plays) : dash),
    row('Accuracy', num(t.accuracy, '%'), num(h.accuracy, '%'), diff(h.accuracy, t.accuracy, ' pts')),
    row('Mistakes (total)', sideHas(t) ? t.mistakes : null, sideHas(h) ? h.mistakes : null, sideHas(t) && sideHas(h) ? diff(h.mistakes, t.mistakes, '', true) : dash),
    row('Mistakes per play', num(t.mistakesPerPlay), num(h.mistakesPerPlay), diff(h.mistakesPerPlay, t.mistakesPerPlay, '', true)),
    row('Perfect finishes (no mistakes, no hints)', sideHas(t) ? `${t.perfect} (${t.perfectRate}%)` : null, sideHas(h) ? `${h.perfect} (${h.perfectRate}%)` : null, dash),
    row('Mastered plays (100% accuracy)', sideHas(t) ? `${t.mastered} (${t.masteredRate}%)` : null, sideHas(h) ? `${h.mastered} (${h.masteredRate}%)` : null, dash),
    row('Hints per play', num(t.hintsPerPlay), num(h.hintsPerPlay), dash),
    row('Minutes played', sideHas(t) ? t.minutes : null, sideHas(h) ? h.minutes : null, sideHas(t) && sideHas(h) ? diff(h.minutes, t.minutes) : dash),
    row('XP earned', sideHas(t) ? t.xp : null, sideHas(h) ? h.xp : null, sideHas(t) && sideHas(h) ? diff(h.xp, t.xp) : dash),
    row('Character stat points', sideHas(t) ? t.statsTotal : null, sideHas(h) ? h.statsTotal : null, sideHas(t) && sideHas(h) ? diff(h.statsTotal, t.statsTotal) : dash),
  ]

  const banner = (() => {
    if (sel.finished && !isAll) {
      return (
        <div className="hs-banner" role="status" style={{ marginTop: 0 }}>
          <img src={PAO} alt="" width="96" height="96" />
          <div className="hs-banner-text">
            <h4>{label} finished! All {games.length} games used their {LIMIT} plays <span aria-hidden="true">🎉</span></h4>
            <p>{fairText}</p>
            <p style={{ color: sel.soapDone ? '#15803D' : '#8A5A0B', fontWeight: 800 }}>{sel.soapDone ? `✓ SOAP note signed ${day(sel.soapAt)}` : sel.draftReady ? 'SOAP note drafted, waiting for your review' : 'SOAP note not ready yet'}</p>
          </div>
          <div className="hs-banner-actions">
            {sel.soapDone && canAct && !newerExists && <button type="button" className="hs-btn green" onClick={() => setRecFor(homeRow)}>Review next set →</button>}
            {sel.soapDone && <button type="button" className="hs-btn" onClick={openNotes}>View SOAP note</button>}
            {!sel.soapDone && canAct && sel.soapNoteId && <button type="button" className="hs-btn green" onClick={openNotes}>📝 Review SOAP note →</button>}
          </div>
        </div>
      )
    }
    if (justStarted) {
      return (
        <div>
          <PaoNote tone="blue" src={PAO_THINK} eyebrow={`${label} just started`}
            actions={<>{onRemind && <Btn primary onClick={remind} disabled={reminding}>{reminding ? 'Sending…' : 'Send a reminder'}</Btn>}{prevOf && <Btn onClick={() => onSetChange(prevOf.id)}>View Set {prevOf.number} results</Btn>}</>}>
            Assigned {day(sel.startedAt)}. Everything below now follows {label} and fills in automatically as {first} plays.{prevOf ? ` Set ${prevOf.number} results stay saved in Completed sets.` : ''}
          </PaoNote>
          {status}
        </div>
      )
    }
    if (!sel.fair && !isAll) {
      return (
        <div>
          <PaoNote src={PAO_THINK} title="Not enough plays yet" actions={reminderBtns}>
            We need at least {minHomePlays} home plays (so far {sel.homePlays}) and 1 therapy play to compare fairly. {first} has {plural(sel.therapyPlays, 'therapy play')}.
          </PaoNote>
          {status}
        </div>
      )
    }
    return <div role="status" style={{ background: '#E3F6EA', color: '#17613A', borderRadius: 16, padding: '14px 18px', fontSize: 15, lineHeight: 1.5 }}>{comparison.text}</div>
  })()

  const overview = (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-3">
        {games.map((g) => {
          const done = g.finished
          return (
            <div key={g.gameId} style={{ border: done ? '2px solid #F0CF5A' : `1px solid ${BORDER}`, background: done ? '#FFFBEA' : '#fff', borderRadius: 18, padding: 18, minWidth: 0 }}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 800, color: GREEN_900, margin: 0 }}><span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: color(g), display: 'inline-block' }} />{g.name}</p>
                {done ? <Chip bg="#FFF3C8" fg="#8A6100">★ Finished</Chip> : g.playsUsed === 0 ? <Chip bg="#EEF2F0" fg={MUTED}>○ Not started</Chip> : <Chip bg="#E4ECFB" fg="#2F5FD0">▶ Playing</Chip>}
              </div>
              <p style={{ margin: '10px 0 8px', color: MUTED, fontSize: 16, fontWeight: 700 }}><span style={{ fontSize: 34, color: GREEN_900 }}>{g.playsUsed}</span> of {g.playsAllowed} plays used</p>
              <div role="progressbar" aria-label={`${g.name} plays used`} aria-valuemin={0} aria-valuemax={g.playsAllowed} aria-valuenow={g.playsUsed} style={{ display: 'grid', gridTemplateColumns: `repeat(${g.playsAllowed}, 1fr)`, gap: 6, marginBottom: 10 }}>
                {Array.from({ length: g.playsAllowed }, (_, i) => <i key={i} style={{ height: 8, borderRadius: 99, background: i < g.playsUsed ? color(g) : '#E3EAE6' }} />)}
              </div>
              <PlayChips list={g.playList} limit={Math.min(g.playsAllowed, LIMIT)} />
            </div>
          )
        })}
      </div>

      {banner}

      {canAct && sel.kind === 'current' && t.plays === 0 && nextSession && (
        <div className="flex flex-wrap items-center gap-3" style={{ border: `1px solid ${BORDER}`, borderRadius: 18, padding: '14px 18px', background: '#F7FAF8' }}>
          <span aria-hidden="true" style={{ fontSize: 26 }}>📅</span>
          <div><b style={{ color: GREEN_900, fontSize: 16 }}>Next therapy session: {sessionText(nextSession)}</b><p style={{ margin: 0, color: MUTED, fontSize: 15 }}>{first} unlocks only {label} games in clinic.</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section style={{ ...CARD, padding: 22 }} aria-label="Therapy sessions vs home practice">
          <h4 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Therapy sessions vs home practice</h4>
          <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 12px' }}>Everything recorded for {label}</p>
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
                {tableRows.map((r) => (
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
          <p style={{ fontSize: 14, color: MUTED, margin: '12px 0 0', lineHeight: 1.45 }}>Each game allows {LIMIT} home plays, so every home number covers all {LIMIT}. Mistakes = tries that were not right. Accuracy = correct ÷ attempts across the plays shown.</p>
        </section>

        <div className="grid grid-cols-1 gap-5" style={{ alignContent: 'start' }}>
          <section style={{ ...CARD, padding: 22 }} aria-label="How each game went">
            <h4 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>How each game went</h4>
            <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 12px' }}>Therapy vs home, per game · {label}</p>
            <ul className="grid grid-cols-1 gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {games.map((g) => {
                const bar = (name, v, c) => (
                  <div className="flex items-center gap-3" style={{ fontSize: 14 }}>
                    <span style={{ width: 58, fontWeight: 800, color: c }}>{name}</span>
                    <div role="progressbar" aria-label={`${g.name} ${name} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v ?? 0} style={{ flex: 1, height: 9, borderRadius: 99, background: '#E8EFEC', overflow: 'hidden' }}><div style={{ width: `${v ?? 0}%`, height: '100%', background: c }} /></div>
                    <b style={{ width: 52, textAlign: 'right', fontSize: 17, color: v == null ? MUTED : GREEN_900 }}>{num(v == null ? null : Math.round(v), '%')}</b>
                  </div>
                )
                const none = g.session.plays === 0 && g.home.plays === 0
                const hard = g.session.plays > 0 && (g.session.mistakesPerPlay > 2 || (g.session.accuracy != null && g.session.accuracy < 60))
                return (
                  <li key={g.gameId} style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
                    <b style={{ fontSize: 17, color: GREEN_900 }}>{g.name}</b>
                    <div className="grid gap-1.5" style={{ margin: '8px 0' }}>{bar('Therapy', g.session.accuracy, THERAPY)}{bar('Home', g.home.accuracy, HOME)}</div>
                    <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Therapy {plural(g.session.plays, 'play')} · Home {plural(g.home.plays, 'play')} · Home mistakes {g.home.mistakes} · {g.session.minutes + g.home.minutes} min</p>
                    {none
                      ? <p style={{ ...noteStyle('grey'), borderRadius: 12, padding: '8px 12px', fontSize: 14, fontWeight: 700, margin: '10px 0 0' }}>Not played yet{nextSession && canAct ? ` · Therapy: first play ${sessionText(nextSession)}` : ''} · Home plays 0 of {g.playsAllowed}</p>
                      : g.note && <p style={{ ...noteStyle(g.note.tone), borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 700, margin: '10px 0 0', display: 'inline-block' }}>{g.note.text}</p>}
                    {hard && <p role="note" style={{ background: '#FDEEEE', color: '#8F1F1F', borderRadius: 12, padding: '8px 12px', fontSize: 14, fontWeight: 700, margin: '10px 0 0' }}><span aria-hidden="true">⚠ </span>Needs another try · {plural(g.session.mistakes, 'mistake')} in therapy</p>}
                  </li>
                )
              })}
            </ul>
          </section>
          {prevOf && sel.kind === 'current' && (
            <section style={{ ...CARD, padding: 18 }} aria-label={`Set ${prevOf.number} recap`}>
              <div className="flex flex-wrap items-center gap-2"><b style={{ fontSize: 17, color: GREEN_900 }}>Set {prevOf.number} · finished {day(prevOf.completedAt)}</b>{prevOf.soapDone && <Chip bg="#E3F6EA" fg="#15803D">✓ SOAP note signed</Chip>}</div>
              <p style={{ margin: '6px 0 8px', color: MUTED, fontSize: 15 }}>{prevOf.recap.plays} of {prevOf.recap.allowed} plays · {prevOf.recap.accuracy != null ? `${prevOf.recap.accuracy}% home accuracy` : 'no score'} · {prevOf.games.join(', ')}</p>
              <button type="button" className="hs-link" onClick={() => onSetChange(prevOf.id)}>View Set {prevOf.number} results →</button>
            </section>
          )}
        </div>
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
        const rows = (k, last) => [['Plays', g[k].plays], ['Accuracy', num(g[k].accuracy == null ? null : Math.round(g[k].accuracy), '%')], ['Mistakes per play', num(g[k].mistakesPerPlay)], ['Hints per play', num(g[k].hintsPerPlay)], ['Perfect finishes', g[k].perfect], ['Mastered plays', g[k].mastered], [k === 'session' ? 'Last played in therapy' : 'Last played at home', last ? day(last) : dash]]
        const col = (k, title, tone, last) => (
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: tone, margin: '0 0 6px' }}>● {title}</p>
            <dl style={{ margin: 0 }}>
              {rows(k, last).map(([name, v]) => (
                <div key={name} className="flex items-center justify-between gap-3" style={{ borderTop: '1px solid #EDF2F0', padding: '8px 0', fontSize: 14 }}>
                  <dt style={{ color: MUTED }}>{name}</dt>
                  <dd style={{ margin: 0, fontWeight: 800, color: v === 0 || v === '0' || v === dash ? '#9AB0A8' : GREEN_900, textAlign: 'right' }}>{v}</dd>
                </div>
              ))}
            </dl>
            {k === 'home' && <div style={{ marginTop: 10 }}><PlayChips list={g.playList} limit={Math.min(g.playsAllowed, LIMIT)} /></div>}
          </div>
        )
        const hacc = g.home.accuracy == null ? null : Math.round(g.home.accuracy)
        return (
          <section key={g.gameId} style={{ ...CARD, padding: 22 }} aria-label={g.name}>
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: '#EAF4EF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{GAME_ICON[g.name] || '🎮'}</span>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <h4 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>{g.name}</h4>
                <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Therapy: {plural(g.session.plays, 'play')} · Home: {plural(g.home.plays, 'play')}</p>
              </div>
              {g.finished ? <Chip bg="#FFF3C8" fg="#8A6100">★ Finished · {g.playsUsed} of {g.playsAllowed} plays</Chip> : <Chip bg="#EEF3F0">{g.playsUsed} of {g.playsAllowed} plays used</Chip>}
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED, margin: 0 }}>Home accuracy</p>
                <p style={{ fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1.1, color: accTone(hacc) }}>{num(hacc, '%')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">{col('session', 'Therapy sessions', THERAPY, g.lastSessionAt)}{col('home', 'Home practice', HOME, g.lastHomeAt)}</div>
            {g.note && <p style={{ ...noteStyle(g.note.tone), borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 700, margin: '14px 0 0', display: 'inline-block' }}>{g.note.text}</p>}
          </section>
        )
      })}
      {shown.length === 0 && <p style={{ color: MUTED, fontSize: 15 }}>No games to show yet.</p>}
    </div>
  )

  /* ── Trends ── */
  const homeDays = new Set(accuracySeries.home.map((p) => p.date)).size
  const therapyDays = new Set(accuracySeries.session.map((p) => p.date)).size
  const playedDays = [...new Set([...accuracySeries.home, ...accuracySeries.session].map((p) => p.date))].sort()
  const days = playedDays.length >= 2 ? playedDays : (dayKeys?.length ? dayKeys : playedDays)
  const noPlays = sel.homePlays + sel.therapyPlays === 0
  const legend = <>{SERIES.map((x) => <LegendDot key={x.key} color={x.color} label={x.label} />)}</>
  const cats = games.map((g) => ({ label: g.name }))
  const mistakeVals = games.map((g) => ({ a: g.session.plays ? g.session.mistakesPerPlay : 0, b: g.home.plays ? g.home.mistakesPerPlay : 0 }))
  const playsCats = games.map((g) => ({ label: g.name }))
  const playsSeries = [{ key: 'home', label: 'Home plays used', color: HOME }]
  const playsVals = games.map((g) => ({ home: g.playsUsed }))
  const limitTop = Math.max(LIMIT, ...games.map((g) => g.playsAllowed))
  const xpShown = xpByWeek.slice(0, 8)
  const xpCats = xpShown.map((w) => ({ label: w.label }))
  const xpVals = xpShown.map((w) => ({ a: w.sessionXp, b: w.homeXp }))
  const statCats = STATS.map(([, l]) => ({ label: l }))
  const statVals = STATS.map(([k]) => ({ a: t.stats[k], b: h.stats[k] }))
  const dayRows = days.map((d) => {
    const pick = (list) => { const v = list.filter((p) => p.date === d).map((p) => p.value); return v.length ? `${Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10}%` : dash }
    return [dayLabel(d), pick(accuracySeries.session), pick(accuracySeries.home)]
  })
  const trends = (
    <div className="grid grid-cols-1 gap-5">
      <PaoNote tone="blue" src={PAO} eyebrow="What the trends show" actions={justStarted && prevOf ? <Btn onClick={() => onSetChange(prevOf.id)}>View Set {prevOf.number}</Btn> : null}>{insight}</PaoNote>
      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-2">
        <ChartCard title="Accuracy over time" subtitle="Each day with plays · home vs therapy" legend={legend}
          chart={<DayLines days={days} home={accuracySeries.home} session={accuracySeries.session} refLine={referenceAverage} empty={noPlays ? { title: `No ${label} plays yet`, sub: `Points appear here as ${first} plays` } : null} />}
          table={<DataTable caption="Accuracy by day" head={['Day', 'Therapy sessions', 'Home practice']} rows={dayRows} />}
          note={<p style={{ background: AMBER_BG, color: AMBER_FG, borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 700, margin: '12px 0 0', display: 'inline-block' }}>{noPlays ? `Waiting for the first ${label} play` : `Therapy has ${plural(therapyDays, 'day')} with plays · home has ${homeDays}`}</p>} />
        <ChartCard title="Mistakes per play, by game" subtitle="Fewer mistakes means the game is going smoothly" legend={legend}
          chart={<GroupedBars caption="Mistakes per play by game" categories={cats} series={SERIES} values={mistakeVals} />}
          table={<GroupedTable caption="Mistakes per play by game" first="Game" categories={cats} series={SERIES} values={mistakeVals} />} />
        <ChartCard title="Plays used per game at home" subtitle={`Each game can be played ${LIMIT} times · ${label}`} legend={<LegendDot color={HOME} label="Home plays used" />}
          chart={<GroupedBars caption="Home plays used per game" categories={playsCats} series={playsSeries} values={playsVals} goal={limitTop} goalLabel={`Play limit ${limitTop}`} decimals={0} />}
          table={<GroupedTable caption="Home plays used per game" first="Game" categories={playsCats} series={playsSeries} values={playsVals} decimals={0} />}
          note={sel.finished ? <p style={{ background: '#E3F6EA', color: '#14532D', borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 700, margin: '12px 0 0', display: 'inline-block' }}>★ All {games.length} games finished</p> : null} />
        <ChartCard title="XP earned per week" subtitle={`Replays keep earning XP and stats · weeks start ${day(sel.startedAt)}`} legend={legend}
          chart={<GroupedBars caption="XP earned per week" categories={xpCats} series={SERIES} values={xpVals} decimals={0} />}
          table={<GroupedTable caption="XP earned per week" first="Week" categories={xpCats} series={SERIES} values={xpVals} decimals={0} />} />
      </div>
      <ChartCard title="Character stat points gained" subtitle={`Home practice vs therapy sessions · ${label}`} legend={legend}
        chart={<GroupedBars caption="Character stat points gained" categories={statCats} series={SERIES} values={statVals} decimals={0} />}
        table={<GroupedTable caption="Character stat points gained" first="Stat" categories={statCats} series={SERIES} values={statVals} decimals={0} />} />
    </div>
  )

  return (
    <section style={CARD} aria-label="Home practice versus therapy sessions">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: GREEN_900, margin: 0 }}>Home practice vs therapy sessions</h3>
          <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 0' }}>{subtitle}</p>
        </div>
        <SegmentedTabs tabs={HOME_TABS} value={tab} onChange={setTab} label="Home practice sections" />
      </div>
      <SetSelector sets={sets} selectedId={sel.id} onPick={(p) => onSetChange(p)} />
      <div className="mt-5" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'by-game' ? byGame : tab === 'trends' ? trends : overview}
      </div>
      {recFor && <RecommendedSetModal patient={recFor} config={config} onClose={() => setRecFor(null)} onAssigned={async () => { setRecFor(null); onSetChange('current'); await load(false) }} onChangeGames={() => { setRecFor(null); navigate('/therapist/assign-games?tab=home') }} />}
    </section>
  )
}
