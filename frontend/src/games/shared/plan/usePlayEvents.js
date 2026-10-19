import { useEffect, useRef } from 'react'
import { authFetch, getSessionToken } from '../../../utils/session'
import { gameProgress } from './gameProgress'
import { norm } from './usePlanState'

const HEARTBEAT_MS = 20000

// Sends live updates for the therapist's play-time monitor while a planned game is open:
// game_started, a heartbeat every 20 s (only while the tab is visible), round_retry, hint_used, game_finished and game_exited.
// Only game, round, score, accuracy, hints and last-input time are sent: nothing personal.
//   plan      the usePlanState() object        open   true while a game screen is mounted
//   getCard   () => the game card being played   activitySessionId   for therapist-hosted play
export default function usePlayEvents({ plan, open, getCard, activitySessionId }) {
  const ctx = useRef({})
  const lastInput = useRef(null)
  const live = useRef(null) // { gameId, planId } while a game is open
  const finished = useRef(false)
  ctx.current = { plan, getCard, activitySessionId }

  const send = (type, extra = {}, { keepalive = false } = {}) => {
    const l = live.current
    if (!l) return
    const body = { type, gameId: l.gameId, ...gameProgress.snapshot(), lastInputAt: lastInput.current, ...extra }
    if (keepalive) {
      const q = ctx.current.activitySessionId ? `?activitySessionId=${ctx.current.activitySessionId}` : ''
      try { fetch(`/api/game-plans/${l.planId}/events${q}`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` }, body: JSON.stringify(body) }) } catch { /* the tab is closing */ }
      return
    }
    authFetch(`/api/game-plans/${l.planId}/events`, { method: 'POST', body, query: ctx.current.activitySessionId ? { activitySessionId: ctx.current.activitySessionId } : undefined }).catch(() => {})
  }

  // A game opens / closes.
  useEffect(() => {
    const p = ctx.current.plan
    if (!open || !p?.plan || p.state === 'off') return undefined
    const card = ctx.current.getCard?.()
    const entry = card && p.plan.games.find((g) => norm(g.name) === norm(card.title))
    if (!entry) return undefined
    live.current = { gameId: entry.gameId, planId: p.plan.id }
    finished.current = false
    gameProgress.reset()
    lastInput.current = new Date().toISOString()
    send('game_started')
    return () => {
      if (!finished.current) send('game_exited')
      live.current = null
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat + last tap/key while a game is open.
  useEffect(() => {
    if (!open) return undefined
    const input = () => { lastInput.current = new Date().toISOString() }
    window.addEventListener('pointerdown', input, true)
    window.addEventListener('keydown', input, true)
    const t = setInterval(() => { if (!document.hidden) send('heartbeat') }, HEARTBEAT_MS)
    const off = gameProgress.subscribe((e) => send(e.type, e.round != null ? { round: e.round } : {}))
    const done = () => { finished.current = true; send('game_finished') }
    window.addEventListener('tp:game-finished', done)
    const bye = () => { if (!finished.current) send('game_exited', {}, { keepalive: true }) }
    window.addEventListener('pagehide', bye)
    return () => {
      clearInterval(t); off()
      window.removeEventListener('pointerdown', input, true); window.removeEventListener('keydown', input, true)
      window.removeEventListener('tp:game-finished', done); window.removeEventListener('pagehide', bye)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}
