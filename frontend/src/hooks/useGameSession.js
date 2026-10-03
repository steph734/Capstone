import { useEffect, useRef } from 'react'
import { useOptionalPao } from '../context/PaoContext'
import { resolveGameIdByName } from '../utils/gameProgress'
import { identBody, hasIdent } from '../utils/paoApi'

// One play of one game, tied to the server's session lifecycle:
//   start   - on mount, once the game's Mongo id is known
//   finish  - call with { correct, attempts, hints_used, stars, detail } on the
//             last screen; applies the reward and shows the reward sequence
//   abandon - leaving mid-game (unmount without finish), via sendBeacon so it
//             still lands when the page is closing
// Practice mode and patients without an identity simply don't start a session.
export function useGameSession({ gameName }) {
  const pao = useOptionalPao()
  const ident = pao?.ident
  const enabled = hasIdent(ident)
  const identKey = ident?.activitySessionId || ident?.patientEmail || ''
  const sessionRef = useRef(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !gameName) return undefined
    let cancelled = false
    finishedRef.current = false
    ;(async () => {
      try {
        const gameId = await resolveGameIdByName(gameName)
        if (!gameId || cancelled) return
        const res = await fetch(`/api/games/${gameId}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(identBody(ident)),
        })
        const body = await res.json().catch(() => ({}))
        if (res.ok && !cancelled) sessionRef.current = { id: body.sessionId }
      } catch {
        // Offline or not a tracked player: the game still plays, just unrecorded.
      }
    })()
    return () => {
      cancelled = true
      const s = sessionRef.current
      sessionRef.current = null
      if (s && !finishedRef.current) {
        navigator.sendBeacon?.(`/api/sessions/${s.id}/abandon`, new Blob(['{}'], { type: 'application/json' }))
      }
    }
  }, [gameName, identKey, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (result) => {
    const s = sessionRef.current
    if (!s || finishedRef.current) return null
    finishedRef.current = true
    const payload = JSON.stringify({ result })
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(`/api/sessions/${s.id}/complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return null // a 4xx won't succeed on retry (e.g. too short)
        pao?.applyServerProfile(data.profile)
        pao?.showReward({ ...data.reward, profile: data.profile })
        return data
      } catch {
        // Network blip: retry once.
      }
    }
    return null
  }

  return { finish }
}
