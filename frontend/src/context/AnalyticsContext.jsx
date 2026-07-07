import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useSharedProgress } from './ProgressContext'
import { computeSessionObservation, ROLLING_BASELINE_WINDOW } from '../utils/sessionAnalytics'

const STORAGE_KEY = 'tp_shared_analytics'

// A few historical SessionObservations for the demo patient (Alvrin) so the
// therapist's "View Stats" screen has a timeline and a rolling baseline to
// compare against before anyone has played a live session in this browser.
const SEED_OBSERVATIONS = [
  {
    id: 'seed-1', sessionId: 'seed-1', patientId: 'alvrin', exerciseId: 'picture-word', domain: 'Cognitive',
    date: '2026-06-26T10:00:00.000Z', durationMinutes: 4, totalResponses: 6,
    accuracy: 50, avgResponseTimeMs: 4600,
    firstHalfAccuracy: 67, secondHalfAccuracy: 33, accuracyDeltaPct: -34,
    firstHalfAvgResponseTimeMs: 3800, secondHalfAvgResponseTimeMs: 5400, responseTimeDeltaMs: 1600,
    retryCount: 0, fallbackUsageCount: 0, frustrationScore: 12, fatigueDropoffScore: 34,
    baselineAccuracy: null, baselineResponseTimeMs: null,
    autoSummaryText: 'Accuracy dropped in the second half of the session — possible fatigue.',
  },
  {
    id: 'seed-2', sessionId: 'seed-2', patientId: 'alvrin', exerciseId: 'picture-word', domain: 'Cognitive',
    date: '2026-06-29T10:00:00.000Z', durationMinutes: 3, totalResponses: 6,
    accuracy: 67, avgResponseTimeMs: 4100,
    firstHalfAccuracy: 67, secondHalfAccuracy: 67, accuracyDeltaPct: 0,
    firstHalfAvgResponseTimeMs: 4200, secondHalfAvgResponseTimeMs: 4000, responseTimeDeltaMs: -200,
    retryCount: 0, fallbackUsageCount: 0, frustrationScore: 0, fatigueDropoffScore: 0,
    baselineAccuracy: 50, baselineResponseTimeMs: 4600,
    autoSummaryText: 'Accuracy was above their recent average — great session!',
  },
  {
    id: 'seed-3', sessionId: 'seed-3', patientId: 'alvrin', exerciseId: 'picture-word', domain: 'Cognitive',
    date: '2026-07-01T10:00:00.000Z', durationMinutes: 4, totalResponses: 6,
    accuracy: 83, avgResponseTimeMs: 3600,
    firstHalfAccuracy: 100, secondHalfAccuracy: 67, accuracyDeltaPct: -33,
    firstHalfAvgResponseTimeMs: 3100, secondHalfAvgResponseTimeMs: 4100, responseTimeDeltaMs: 1000,
    retryCount: 0, fallbackUsageCount: 0, frustrationScore: 12, fatigueDropoffScore: 33,
    baselineAccuracy: 58, baselineResponseTimeMs: 4350,
    autoSummaryText: 'Accuracy was above their recent average — great session!',
  },
  {
    id: 'seed-4', sessionId: 'seed-4', patientId: 'alvrin', exerciseId: 'picture-word', domain: 'Cognitive',
    date: '2026-07-03T10:00:00.000Z', durationMinutes: 3, totalResponses: 6,
    accuracy: 83, avgResponseTimeMs: 3300,
    firstHalfAccuracy: 67, secondHalfAccuracy: 100, accuracyDeltaPct: 33,
    firstHalfAvgResponseTimeMs: 3500, secondHalfAvgResponseTimeMs: 3100, responseTimeDeltaMs: -400,
    retryCount: 0, fallbackUsageCount: 0, frustrationScore: 0, fatigueDropoffScore: 0,
    baselineAccuracy: 67, baselineResponseTimeMs: 3950,
    autoSummaryText: 'Accuracy was above their recent average — great session!',
  },
  {
    id: 'seed-5', sessionId: 'seed-5', patientId: 'alvrin', exerciseId: 'picture-word', domain: 'Cognitive',
    date: '2026-07-05T10:00:00.000Z', durationMinutes: 4, totalResponses: 6,
    accuracy: 67, avgResponseTimeMs: 3900,
    firstHalfAccuracy: 67, secondHalfAccuracy: 67, accuracyDeltaPct: 0,
    firstHalfAvgResponseTimeMs: 3900, secondHalfAvgResponseTimeMs: 3900, responseTimeDeltaMs: 0,
    retryCount: 0, fallbackUsageCount: 0, frustrationScore: 0, fatigueDropoffScore: 0,
    baselineAccuracy: 71, baselineResponseTimeMs: 3625,
    autoSummaryText: 'Steady, consistent session with no notable changes.',
  },
]

const INITIAL_ANALYTICS = { events: [], observations: SEED_OBSERVATIONS }

function loadAnalytics() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ANALYTICS))
  return INITIAL_ANALYTICS
}

const AnalyticsCtx = createContext(null)

export function AnalyticsProvider({ children }) {
  const [analytics, setAnalytics] = useState(loadAnalytics)
  const { recordGameSession } = useSharedProgress()
  // Seeded observations are already reflected in ProgressContext's seed data —
  // only observations appended after mount should feed back into it.
  const lastRecordedIdRef = useRef(analytics.observations[analytics.observations.length - 1]?.id ?? null)

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setAnalytics(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const persist = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  }

  // Simulates POST /api/events — ingests a batch, and if it contains the
  // session-end checkpoint, runs the descriptive-analytics aggregation job
  // (Layer 3) and writes the resulting SessionObservation.
  const submitEventBatch = (batch) => {
    if (!batch || batch.length === 0) return
    setAnalytics((prev) => {
      const events = [...prev.events, ...batch].slice(-1000)
      const sessionEndedNow = batch.some((e) => e.eventType === 'exit')
      if (!sessionEndedNow) return persist({ ...prev, events })

      const { sessionId, patientId, exerciseId, domain } = batch[0]
      const sessionEvents = events.filter((e) => e.sessionId === sessionId)
      const baselineObservations = prev.observations
        .filter((o) => o.patientId === patientId && o.domain === domain)
        .slice(-ROLLING_BASELINE_WINDOW)
      const observation = computeSessionObservation({ sessionId, patientId, exerciseId, domain, events: sessionEvents, baselineObservations })

      return persist({ ...prev, events, observations: [...prev.observations, observation].slice(-200) })
    })
  }

  // Mirror the newest session's headline numbers into ProgressContext so the
  // parent-facing Progress page reflects real gameplay, not just mock data.
  useEffect(() => {
    const latest = analytics.observations[analytics.observations.length - 1]
    if (!latest || latest.id === lastRecordedIdRef.current) return
    lastRecordedIdRef.current = latest.id
    if (latest.patientId === 'alvrin') {
      recordGameSession({ domain: latest.domain, accuracy: latest.accuracy, durationMinutes: latest.durationMinutes })
    }
  }, [analytics.observations]) // eslint-disable-line

  return (
    <AnalyticsCtx.Provider value={{ analytics, submitEventBatch }}>
      {children}
    </AnalyticsCtx.Provider>
  )
}

export const useAnalytics = () => useContext(AnalyticsCtx)
