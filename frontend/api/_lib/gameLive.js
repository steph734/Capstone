// Live play-time monitor: turns a plan + its game_play_events into what the therapist sees.
import { GamePlayEvent } from './models/gamePlayEvent.js'
import { durationOf, planRemaining } from './gamePlans.js'

const IDLE_MS = 2 * 60 * 1000
const OFFLINE_MS = 60 * 1000
const WARN_MS = 5 * 60 * 1000

const num = (v) => (v == null ? null : Number(v))

// Group the events of one plan into "plays" (one per game_started).
function plays(events) {
  const list = []
  const openFor = new Map() // game_session_id or game_id -> play
  for (const e of events) {
    const key = String(e.game_session_id || e.game_id)
    let p = openFor.get(key)
    if (e.type === 'game_started' || (!p && e.type === 'heartbeat')) {
      p = { gameId: String(e.game_id), startedAt: e.at, lastAt: e.at, open: true, round: null, totalRounds: null, score: null, accuracy: null, hints: 0, lastInputAt: null, retries: new Map(), lastRetryAt: new Map(), endedAt: null, finished: false }
      list.push(p); openFor.set(key, p)
    }
    p.lastAt = e.at
    if (e.round != null) p.round = e.round
    if (e.total_rounds != null) p.totalRounds = e.total_rounds
    if (e.score != null) p.score = e.score
    if (e.accuracy != null) p.accuracy = e.accuracy
    if (e.hints != null) p.hints = Math.max(p.hints, e.hints)
    if (e.last_input_at) p.lastInputAt = e.last_input_at
    if (e.type === 'round_retry') { const r = e.round ?? 0; p.retries.set(r, (p.retries.get(r) || 0) + 1); p.lastRetryAt.set(r, e.at) }
    if (e.type === 'hint_used') p.hints = Math.max(p.hints, (e.hints ?? p.hints) || 0) + (e.hints == null ? 1 : 0)
    if (e.type === 'game_finished' || e.type === 'game_exited') { p.open = false; p.endedAt = e.at; p.finished = e.type === 'game_finished'; openFor.delete(key) }
  }
  return list
}

// `names`: Map(gameId -> { name, difficulty }). Returns the object the monitor renders.
export async function computeLive(plan, patient, names, now = new Date()) {
  const events = await GamePlayEvent.find({ plan_id: plan._id }).sort({ at: 1 }).lean()
  const ps = plays(events)
  const nowMs = now.getTime()
  const frozen = plan.status === 'paused' && plan.paused_at ? new Date(plan.paused_at).getTime() : nowMs
  const seconds = (p) => Math.max(0, Math.round(((p.open ? Math.min(nowMs, frozen) : (p.endedAt || p.lastAt).getTime()) - p.startedAt.getTime()) / 1000))

  const games = [...plan.games].sort((a, b) => a.order - b.order).map((g) => {
    const id = String(g.game_id)
    const mine = ps.filter((p) => p.gameId === id)
    const last = mine[mine.length - 1]
    const info = names.get(id) || { name: 'Game', difficulty: 'easy' }
    return {
      gameId: id, name: info.name, difficulty: info.difficulty, plannedMinutes: g.minutes,
      status: g.status === 'done' ? 'done' : mine.some((p) => p.open) ? 'in_progress' : g.status,
      secondsPlayed: mine.reduce((s, p) => s + seconds(p), 0),
      score: num(last?.score), accuracy: num(last?.accuracy), hints: last ? last.hints : 0,
    }
  })

  const paused = plan.status === 'paused'
  const open = [...ps].reverse().find((p) => p.open)
  const nowPlaying = open ? {
    gameId: open.gameId, name: (names.get(open.gameId) || {}).name || 'Game', startedAt: open.startedAt.toISOString(), secondsInGame: seconds(open),
    round: open.round, totalRounds: open.totalRounds, lastInputAt: (open.lastInputAt || open.startedAt).toISOString(),
  } : null

  const first = String(patient?.nickname || patient?.first_name || 'The patient')
  const alerts = []
  if (open && !paused) { // no idle / offline alerts while play time is paused
    const lastInput = (open.lastInputAt || open.startedAt).getTime()
    if (nowMs - lastInput > IDLE_MS) alerts.push({ type: 'idle', key: `idle:${open.startedAt.getTime()}`, message: 'No taps for 2 minutes', at: new Date(lastInput + IDLE_MS).toISOString() })
    if (nowMs - open.lastAt.getTime() > OFFLINE_MS) alerts.push({ type: 'offline', key: `offline:${open.startedAt.getTime()}`, message: `${first}'s device is offline`, at: new Date(open.lastAt.getTime() + OFFLINE_MS).toISOString() })
  }
  for (const p of ps) for (const [r, n] of p.retries) if (n >= 3) alerts.push({ type: 'stuck', key: `stuck:${p.gameId}:${p.startedAt.getTime()}:${r}`, message: `Round ${r} tried ${n} times`, detail: `${(names.get(p.gameId) || {}).name || 'Game'} · consider a hint or an easier game.`, at: p.lastRetryAt.get(r).toISOString() })
  const remaining = planRemaining(plan)
  const ended = plan.status === 'ended'
  if (plan.status === 'active' && !ended && remaining > 0 && remaining * 1000 <= WARN_MS) alerts.push({ type: 'ending', key: 'ending', message: '5 minutes left', at: new Date(plan.play_end.getTime() - WARN_MS).toISOString() })
  if (ended) alerts.push({ type: 'timeup', key: 'timeup', message: "Time's up", at: plan.play_end.toISOString() })
  alerts.sort((a, b) => (a.at < b.at ? 1 : -1))

  const done = games.filter((g) => g.status === 'done')
  const accs = done.map((g) => g.accuracy).filter((a) => a != null)
  const summary = {
    done: done.length, total: games.length, minutesPlayed: Math.round(games.reduce((s, g) => s + g.secondsPlayed, 0) / 60),
    accuracy: accs.length ? Math.round(accs.reduce((s, a) => s + a, 0) / accs.length) : null, hints: games.reduce((s, g) => s + (g.hints || 0), 0),
  }
  const pausedAt = plan.paused_at || (plan.status === 'paused' ? plan.updated_at : null)
  return {
    planId: String(plan._id), patientId: String(plan.patient_id), status: ended ? 'ended' : plan.status,
    playStart: plan.play_start.toISOString(), playEnd: plan.play_end.toISOString(), pausedAt: pausedAt ? new Date(pausedAt).toISOString() : null,
    now: now.toISOString(), remainingSeconds: ended ? 0 : remaining, totalSeconds: durationOf(plan) + (plan.extended_seconds || 0), durationSeconds: durationOf(plan), extendedSeconds: plan.extended_seconds || 0, usedSeconds: plan.used_seconds || 0,
    pauseCount: plan.pause_count || 0, totalPausedSeconds: (plan.total_paused_seconds || 0) + (paused && plan.paused_at ? Math.round((nowMs - new Date(plan.paused_at).getTime()) / 1000) : 0), startedEarly: Boolean(plan.started_early),
    startedAt: plan.started_at ? plan.started_at.toISOString() : null,
    warnAt: plan.warn_before_minutes ? new Date(plan.play_end.getTime() - plan.warn_before_minutes * 60000).toISOString() : null,
    allowFinishCurrent: plan.allow_finish_current, startManually: plan.start_manually, warnBeforeMinutes: plan.warn_before_minutes,
    nowPlaying, games, summary, alerts,
  }
}

export function soapText(live) {
  const parts = live.games.filter((g) => g.status === 'done' || g.secondsPlayed > 0).map((g) => {
    const detail = [g.score != null ? `${g.score}` : null, g.accuracy != null ? `${g.accuracy}%` : null, `${g.hints || 0} hint${g.hints === 1 ? '' : 's'}`].filter(Boolean).join(', ')
    return `${g.name} (${detail})`
  })
  const planned = Math.round(live.totalSeconds / 60)
  return `Games: ${parts.length ? parts.join('; ') : 'none played yet'}. Played ${live.summary.minutesPlayed} min of ${planned}.`
}
