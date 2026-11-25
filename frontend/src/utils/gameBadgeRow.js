// Badge progress for the results screen, read from the real badge API (the same data the Badge Case shows).
// Resolves to { name, progress, target, rewardOutfit, earned } for the badge tied to `gameName`, or null when there
// is no player (owner preview), no matching badge, or the API is unavailable, so callers simply hide the row.
export async function fetchBadgeRow(ident, gameName) {
  if (!ident?.activitySessionId && !ident?.patientEmail) return null
  try {
    const q = ident.activitySessionId ? `activitySessionId=${encodeURIComponent(ident.activitySessionId)}` : `patientEmail=${encodeURIComponent(ident.patientEmail)}`
    const body = await fetch(`/api/pao/badges?${q}`).then((r) => r.json())
    const b = (body.badges || []).find((x) => x.relatedGameName === gameName && x.target > 0)
    if (!b) return null
    return { name: b.name, progress: b.earned ? b.target : b.progress ?? 0, target: b.target, rewardOutfit: b.rewardOutfit, earned: b.earned }
  } catch {
    return null
  }
}
