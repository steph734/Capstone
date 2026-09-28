// Bridges "a patient finished a game" to the real wardrobe/badge unlock
// pipeline (api/_lib/routes/game-progress-*.js). Games only know a real Mongo
// game `_id` — needed to match a wardrobe item's `unlock.game_id` — by name,
// via the published games list, since nothing else maps a frontend game
// screen to its Mongo document.
let gameIdMapPromise = null

function loadGameIdMap() {
  if (!gameIdMapPromise) {
    gameIdMapPromise = fetch('/api/games/list')
      .then((r) => r.json())
      .then((body) => {
        const map = {}
        ;(body.games || []).forEach((g) => { if (g.name) map[g.name.trim().toLowerCase()] = g.id })
        return map
      })
      .catch(() => ({}))
  }
  return gameIdMapPromise
}

// Fire-and-forget: a patient finishing a game should never be blocked or
// broken by this failing (offline, not logged in, name not published yet).
export async function reportGameCompletion({ patientEmail, gameName, score = null, maxScore = null }) {
  if (!patientEmail || !gameName) return
  try {
    const map = await loadGameIdMap()
    const gameId = map[gameName.trim().toLowerCase()]
    if (!gameId) return
    await fetch('/api/game-progress/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientEmail, gameId, gameName, score, maxScore }),
    })
  } catch {
    // best-effort — local gameplay state already reflects completion
  }
}

export async function fetchUnlockState(patientEmail) {
  const empty = { unlockedItemCodes: [], earnedBadgeCodes: [] }
  if (!patientEmail) return empty
  try {
    const res = await fetch(`/api/game-progress/unlocks?patientEmail=${encodeURIComponent(patientEmail)}`)
    if (!res.ok) return empty
    const body = await res.json()
    return { unlockedItemCodes: body.unlockedItemCodes || [], earnedBadgeCodes: body.earnedBadgeCodes || [] }
  } catch {
    return empty
  }
}
