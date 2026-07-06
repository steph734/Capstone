// Layer 3 — descriptive analytics ("Descriptive Analytics Algorithm").
//
// Pure aggregation over a session's raw GameplayEvents: means, first-half vs
// second-half deltas, and simple threshold rules for the auto-summary text.
// No ML — this is the same scope as the paper (counts, averages, deltas).

const FATIGUE_ACCURACY_DROP_THRESHOLD = 15   // percentage points, second half vs first half
const FALLBACK_USAGE_THRESHOLD = 2
const FRUSTRATION_SCORE_THRESHOLD = 50
const BASELINE_DELTA_THRESHOLD = 10          // percentage points vs rolling baseline
const BASELINE_WINDOW = 10                   // rolling baseline = last N sessions for this domain

function average(nums) {
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0
}

function accuracyOf(responses) {
  if (responses.length === 0) return 0
  const correct = responses.filter((r) => r.isCorrect).length
  return Math.round((correct / responses.length) * 100)
}

function longestWrongStreak(responses) {
  let streak = 0
  let max = 0
  for (const r of responses) {
    if (r.isCorrect) { streak = 0 }
    else { streak += 1; max = Math.max(max, streak) }
  }
  return max
}

// `events` = all GameplayEvents for one sessionId.
// `baselineObservations` = the patient's last few SessionObservations for the
// same domain (rolling baseline), most recent last is not required.
export function computeSessionObservation({ sessionId, patientId, exerciseId, domain, events, baselineObservations = [] }) {
  const responses = events.filter((e) => e.eventType === 'response_given')
  const total = responses.length

  const accuracy = accuracyOf(responses)
  const avgResponseTimeMs = Math.round(average(responses.map((r) => r.responseTimeMs || 0)))

  const mid = Math.floor(total / 2)
  const firstHalf = responses.slice(0, mid)
  const secondHalf = responses.slice(mid)
  const firstHalfAccuracy = firstHalf.length ? accuracyOf(firstHalf) : accuracy
  const secondHalfAccuracy = secondHalf.length ? accuracyOf(secondHalf) : accuracy
  const accuracyDeltaPct = secondHalfAccuracy - firstHalfAccuracy

  const firstHalfAvgResponseTimeMs = Math.round(average(firstHalf.map((r) => r.responseTimeMs || 0))) || avgResponseTimeMs
  const secondHalfAvgResponseTimeMs = Math.round(average(secondHalf.map((r) => r.responseTimeMs || 0))) || avgResponseTimeMs
  const responseTimeDeltaMs = secondHalfAvgResponseTimeMs - firstHalfAvgResponseTimeMs

  const retryCount = events.filter((e) => e.eventType === 'retry').length
  const fallbackUsageCount = events.filter((e) => e.eventType === 'fallback_used').length
  const wrongStreak = longestWrongStreak(responses)

  const fatigueDropoffScore = Math.max(0, -accuracyDeltaPct)
  const frustrationScore = Math.min(100, retryCount * 15 + fallbackUsageCount * 10 + wrongStreak * 12)

  const baselineAccuracy = baselineObservations.length
    ? Math.round(average(baselineObservations.map((o) => o.accuracy)))
    : null
  const baselineResponseTimeMs = baselineObservations.length
    ? Math.round(average(baselineObservations.map((o) => o.avgResponseTimeMs)))
    : null

  const notes = []
  if (fatigueDropoffScore > FATIGUE_ACCURACY_DROP_THRESHOLD) {
    notes.push('Accuracy dropped in the second half of the session — possible fatigue.')
  }
  if (fallbackUsageCount > FALLBACK_USAGE_THRESHOLD) {
    notes.push('Needed several hints today — consider more speech encouragement at home.')
  }
  if (frustrationScore > FRUSTRATION_SCORE_THRESHOLD) {
    notes.push('Several wrong answers in a row — may have felt frustrated during this session.')
  }
  if (baselineAccuracy !== null && accuracy > baselineAccuracy + BASELINE_DELTA_THRESHOLD) {
    notes.push('Accuracy was above their recent average — great session!')
  } else if (baselineAccuracy !== null && accuracy < baselineAccuracy - BASELINE_DELTA_THRESHOLD) {
    notes.push('Accuracy was below their recent average today.')
  }
  if (notes.length === 0) {
    notes.push('Steady, consistent session with no notable changes.')
  }

  const firstTs = events.length ? Math.min(...events.map((e) => e.timestamp)) : Date.now()
  const lastTs = events.length ? Math.max(...events.map((e) => e.timestamp)) : firstTs
  const durationMinutes = Math.max(1, Math.round((lastTs - firstTs) / 60000))

  return {
    id: sessionId,
    sessionId,
    patientId,
    exerciseId,
    domain,
    date: new Date(lastTs).toISOString(),
    durationMinutes,
    totalResponses: total,
    accuracy,
    avgResponseTimeMs,
    firstHalfAccuracy,
    secondHalfAccuracy,
    accuracyDeltaPct,
    firstHalfAvgResponseTimeMs,
    secondHalfAvgResponseTimeMs,
    responseTimeDeltaMs,
    retryCount,
    fallbackUsageCount,
    frustrationScore,
    fatigueDropoffScore,
    baselineAccuracy,
    baselineResponseTimeMs,
    autoSummaryText: notes.join(' '),
  }
}

export const ROLLING_BASELINE_WINDOW = BASELINE_WINDOW
