import { useEffect, useRef } from 'react'
import { useOptionalPao } from '../context/PaoContext'
import { resolveGameIdByName } from '../utils/gameProgress'
import { identBody, hasIdent } from '../utils/paoApi'

// Games must end with finish(). Never award rewards inside a game: the server decides XP, badge, stats and outfit,
// and the shared RewardsFlow shows them. (See games/shared/gameRegistry.js.)
//
// One play of one game, tied to the server's session lifecycle:
//   start   - on mount, once the game's Mongo id is known (retried, never silent: a failure is shown at the end)
//   finish  - call with { correct, attempts, hints_used, stars, detail } on the last screen; the server awards
//             everything once per session (the same session can be sent again safely) and the rewards flow opens.
//             If saving fails, the flow shows a "couldn't save your rewards" card with Retry.
//   abandon - leaving mid-game (unmount without finish), via sendBeacon so it still lands when the page is closing;
//             the flow shows the "Keep going" card.
// Practice mode and patients without an identity simply don't start a session.
const log = (...a) => { if (import.meta.env.DEV) console.info('[rewards]', ...a) }

export function useGameSession({ gameName }) {
  const pao = useOptionalPao()
  const ident = pao?.ident
  const enabled = hasIdent(ident)
  const identKey = ident?.activitySessionId || ident?.patientEmail || ''
  const sessionRef = useRef(null)
  const startRef = useRef(null)
  const lastError = useRef('')
  const finishedRef = useRef(false)
  const inflight = useRef(false)
  const aliveRef = useRef(true)
  const paoRef = useRef(pao)
  useEffect(() => { paoRef.current = pao })

  // Start (up to 3 tries). Resolves to { id } or null; the reason is kept in lastError.
  const startSession = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const gameId = await resolveGameIdByName(gameName)
        if (!gameId) { lastError.current = `There is no game record named "${gameName}".`; log('unknown game', gameName); return null }
        const res = await fetch(`/api/games/${gameId}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(identBody(ident)),
        })
        const body = await res.json().catch(() => ({}))
        if (res.ok) { sessionRef.current = { id: body.sessionId }; log('session started', gameName, body.sessionId); return sessionRef.current }
        lastError.current = body.error || `The server said ${res.status}.`
        log('start failed', res.status, body)
        if (res.status >= 400 && res.status < 500) return null
      } catch (e) {
        lastError.current = 'No internet connection.'
        log('start error', e)
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    return null
  }

  useEffect(() => {
    if (!enabled || !gameName) return undefined
    aliveRef.current = true
    finishedRef.current = false
    sessionRef.current = null
    startRef.current = startSession()
    return () => {
      aliveRef.current = false
      const s = sessionRef.current
      sessionRef.current = null
      if (s && !finishedRef.current) {
        log(`${gameName} ended without onFinish`)
        navigator.sendBeacon?.(`/api/sessions/${s.id}/abandon`, new Blob(['{}'], { type: 'application/json' }))
        paoRef.current?.showReward?.({ exit: true, gameName }) // "Keep going": nothing was earned
      }
    }
  }, [gameName, identKey, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (result) => {
    if (!enabled || finishedRef.current || inflight.current) return null
    inflight.current = true
    log('finish called', gameName, result)
    const fail = (message) => {
      log('finish failed', message)
      paoRef.current?.showReward?.({ error: true, message, gameName, stars: result?.stars ?? 0, retry: () => finish(result) })
      return null
    }
    try {
      const s = sessionRef.current || (await startRef.current) || (await startSession())
      if (!s) return fail(lastError.current)
      const payload = JSON.stringify({ result })
      let message = 'No internet connection.'
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = await fetch(`/api/sessions/${s.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
          const data = await res.json().catch(() => ({}))
          log('API result', res.status, data)
          if (res.ok) {
            finishedRef.current = true
            const p = paoRef.current
            p?.applyServerProfile(data.profile) // the header (level, XP bar) updates without a reload
            p?.showReward({ ...data.reward, profile: data.profile, stars: result?.stars ?? 0, gameName })
            log('flow opened', gameName)
            return data
          }
          message = data.error || `The server said ${res.status}.`
          if (res.status >= 400 && res.status < 500) break // a 4xx won't succeed on retry
        } catch { /* network blip: retry once */ }
      }
      return fail(message)
    } finally {
      inflight.current = false
    }
  }

  return { finish }
}
