// Layer 1 — frontend event instrumentation.
//
// Captures raw behavioral events during gameplay and batches them
// client-side, flushing at natural checkpoints (task complete, session end)
// instead of one request per event. `onFlush` is the "POST to the backend" —
// in this app that's AnalyticsContext.submitEventBatch, which simulates the
// server-side ingestion + aggregation described in the paper.

const BATCH_SIZE = 10
const SESSION_END_EVENT_TYPES = new Set(['exit'])

export function createSessionId() {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEventLogger({ patientId, exerciseId, sessionId, domain, onFlush }) {
  let buffer = []

  const flush = () => {
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    onFlush?.(batch)
  }

  const log = (eventType, fields = {}) => {
    const event = {
      patientId,
      exerciseId,
      sessionId,
      domain,
      eventType,
      timestamp: Date.now(),
      responseTimeMs: fields.responseTimeMs ?? null,
      isCorrect: fields.isCorrect ?? null,
      inputMethod: fields.inputMethod ?? null,
      touchPressure: fields.touchPressure ?? null,
      dragPath: fields.dragPath ?? null,
      sttConfidenceScore: fields.sttConfidenceScore ?? null,
      voiceDurationMs: fields.voiceDurationMs ?? null,
    }
    buffer.push(event)

    if (buffer.length >= BATCH_SIZE || SESSION_END_EVENT_TYPES.has(eventType)) {
      flush()
    }
  }

  return { log, flush }
}

// Reads the `pressure` property exposed by the Pointer Events API
// (pointerdown/pointermove/pointerup) — richer than click/touch alone,
// since it also carries drag/grip precision signal when available.
export function getPointerPressure(pointerEvent) {
  if (!pointerEvent || typeof pointerEvent.pressure !== 'number') return null
  // Mouse pointers always report 0 or 0.5; only trust it for pen/touch.
  if (pointerEvent.pointerType === 'mouse') return null
  return pointerEvent.pressure
}
