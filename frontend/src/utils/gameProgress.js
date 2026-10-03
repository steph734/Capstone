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

export async function resolveGameIdByName(gameName) {
  if (!gameName) return null
  const map = await loadGameIdMap()
  return map[gameName.trim().toLowerCase()] || null
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

// The real, admin-authored badge library — cached for the session since it
// rarely changes and several games/screens all want it.
let badgesPromise = null

export function loadBadges() {
  if (!badgesPromise) {
    badgesPromise = fetch('/api/badges/list')
      .then((r) => r.json())
      .then((body) => (body.badges || []).filter((b) => b.isActive && !b.isArchived))
      .catch(() => [])
  }
  return badgesPromise
}

// The real badge (if any) an admin has tied to this game finishing —
// replaces the old hardcoded per-game placeholder badge once a matching one
// exists in the database.
export async function fetchGameBadge(gameName) {
  if (!gameName) return null
  const [map, badges] = await Promise.all([loadGameIdMap(), loadBadges()])
  const gameId = map[gameName.trim().toLowerCase()]
  if (!gameId) return null
  return badges.find((b) => b.criteriaType === 'complete_specific_game' && b.criteriaGameId === gameId) || null
}
