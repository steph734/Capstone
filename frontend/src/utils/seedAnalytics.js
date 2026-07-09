// Generates realistic-looking SessionObservations for every mock patient
// shown in the therapist/owner "Gamified Activities" tables, across all four
// domains — so "View Stats" never shows an empty state for anyone but the
// live demo patient (Alvrin, whose real data comes from actual gameplay).
//
// Deterministic (seeded by patientId+domain+session index) so the same
// "random" numbers show up on every load instead of reshuffling each time.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

// Plausible exercise ids per domain — Occupational/Physical don't have
// concrete games in this build yet, but the analytics pipeline is
// domain-agnostic, so these stand in for future/assigned exercises.
const DOMAIN_EXERCISES = {
  Cognitive:    ['picture-word', 'puzzle-pieces', 'story-red-riding-hood'],
  Speech:       ['echo', 'sound-hunt', 'rhyme-time'],
  Occupational: ['fine-motor-tracing', 'shape-sorting'],
  Physical:     ['balance-beam', 'coordination-hop'],
}

// Rough skill baseline per mock patient (0-100), loosely matching their level
// in the therapist/owner patient tables so the numbers feel connected.
const PATIENT_SKILL = {
  'aira lopez':      62,
  'mika santos':     68,
  'noah cruz':       42,
  'sofia reyes':     88,
  'liam tan':        60,
  'emma villanueva': 35,
  'carlos mendez':   74,
  'isabella park':   50,
  'jake rivera':     63,
  'maya torres':     32,
  'lily santos':     65,
  'jasper reyes':    80,
}

const SESSIONS_PER_DOMAIN = 4
const DAY_MS = 24 * 60 * 60 * 1000
// Anchored to the same fictional "today" the rest of the mock data uses
// (patient tables show "Last Played" dates up through Jul 5, 2026).
const ANCHOR = new Date('2026-07-06T09:00:00.000Z').getTime()

export function generateSeedObservations() {
  const observations = []

  Object.entries(PATIENT_SKILL).forEach(([patientId, baseAccuracy]) => {
    Object.entries(DOMAIN_EXERCISES).forEach(([domain, exercises]) => {
      const priorSessions = []

      for (let i = 0; i < SESSIONS_PER_DOMAIN; i++) {
        const rand = mulberry32(hashString(`${patientId}|${domain}|${i}`))
        const dayOffset = (SESSIONS_PER_DOMAIN - i) * 3 + Math.floor(rand() * 2)
        const date = new Date(ANCHOR - dayOffset * DAY_MS)

        const improvementTrend = i * 2 // mild session-over-session improvement
        const accuracy = clamp(Math.round(baseAccuracy + improvementTrend + (rand() - 0.5) * 20), 20, 100)
        const firstHalfAccuracy  = clamp(Math.round(accuracy + (rand() - 0.5) * 20), 0, 100)
        const secondHalfAccuracy = clamp(Math.round(accuracy + (rand() - 0.5) * 20), 0, 100)
        const accuracyDeltaPct = secondHalfAccuracy - firstHalfAccuracy

        const avgResponseTimeMs = Math.round(6200 - baseAccuracy * 35 + (rand() - 0.5) * 800)
        const firstHalfAvgResponseTimeMs  = Math.round(avgResponseTimeMs + (rand() - 0.5) * 400)
        const secondHalfAvgResponseTimeMs = Math.round(avgResponseTimeMs + (rand() - 0.5) * 400)
        const responseTimeDeltaMs = secondHalfAvgResponseTimeMs - firstHalfAvgResponseTimeMs

        const retryCount = Math.round(rand() * 2)
        const fallbackUsageCount = Math.round(rand() * 1.4)
        const fatigueDropoffScore = Math.max(0, -accuracyDeltaPct)
        const frustrationScore = clamp(Math.round(retryCount * 15 + fallbackUsageCount * 10 + rand() * 20), 0, 100)

        const baselineAccuracy = priorSessions.length
          ? Math.round(priorSessions.reduce((s, o) => s + o.accuracy, 0) / priorSessions.length)
          : null
        const baselineResponseTimeMs = priorSessions.length
          ? Math.round(priorSessions.reduce((s, o) => s + o.avgResponseTimeMs, 0) / priorSessions.length)
          : null

        const notes = []
        if (fatigueDropoffScore > 15) notes.push('Accuracy dropped in the second half of the session — possible fatigue.')
        if (fallbackUsageCount > 2) notes.push('Needed several hints today — consider more encouragement at home.')
        if (frustrationScore > 50) notes.push('Several wrong answers in a row — may have felt frustrated during this session.')
        if (baselineAccuracy !== null && accuracy > baselineAccuracy + 10) notes.push('Accuracy was above their recent average — great session!')
        else if (baselineAccuracy !== null && accuracy < baselineAccuracy - 10) notes.push('Accuracy was below their recent average today.')
        if (notes.length === 0) notes.push('Steady, consistent session with no notable changes.')

        const id = `seed-${patientId.replace(/\s+/g, '-')}-${domain.toLowerCase()}-${i}`
        const observation = {
          id, sessionId: id, patientId,
          exerciseId: exercises[i % exercises.length],
          domain,
          date: date.toISOString(),
          durationMinutes: 3 + Math.round(rand() * 3),
          totalResponses: 6,
          accuracy, avgResponseTimeMs,
          firstHalfAccuracy, secondHalfAccuracy, accuracyDeltaPct,
          firstHalfAvgResponseTimeMs, secondHalfAvgResponseTimeMs, responseTimeDeltaMs,
          retryCount, fallbackUsageCount, frustrationScore, fatigueDropoffScore,
          baselineAccuracy, baselineResponseTimeMs,
          autoSummaryText: notes.join(' '),
        }

        observations.push(observation)
        priorSessions.push(observation)
      }
    })
  })

  return observations.sort((a, b) => new Date(a.date) - new Date(b.date))
}
