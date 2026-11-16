// The three steps of the "Sending your payment details" list, built from the REAL submit state (no made-up values).
const peso = (n) => '₱ ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const mb = (bytes) => (bytes / 1048576).toFixed(1)

// state: the controller state.  ctx: { methodLabel, amount, fileName, therapist, notified }
// -> [{ id, title, detail, status: 'done' | 'active' | 'waiting', startOffsetMs, durationMs, indeterminate, amber }]
export function buildSteps(state, { methodLabel, amount, fileName, therapist, notified = true }) {
  const done = state.status === 'done'
  const slow = state.mode === 'slow'
  const s = state.steps

  let detail
  if (done) detail = 'Saved'
  else if (state.offline) detail = "You're offline. We'll retry as soon as you're back."
  else if (state.retrying || state.attempt > 1) detail = `Retrying… (attempt ${state.attempt} of ${state.maxAttempts})`
  else if (state.uploadDone) detail = 'Saving…'
  else if (state.progressSupported && state.fileSize) detail = `Uploading ${fileName || 'receipt'} · ${mb(state.uploadedBytes)} of ${mb(state.fileSize)} MB`
  else detail = `Uploading ${fileName || 'receipt'}`

  return [
    { id: 'confirmed', title: 'Payment confirmed', detail: `${methodLabel} · ${peso(amount)}`, status: 'done', startOffsetMs: 0, durationMs: s.confirmedMs },
    {
      id: 'saving', title: 'Saving your reference number and receipt', detail, status: done ? 'done' : 'active', startOffsetMs: s.saveStartMs,
      durationMs: done ? (s.saveEndMs ?? 0) - s.saveStartMs : null, indeterminate: !done && (state.uploadDone || state.offline || state.retrying || !state.progressSupported), amber: slow && !done,
    },
    {
      id: 'sending', title: `Sending to ${therapist || 'your therapist'}`, detail: done && !notified ? `We'll keep trying to reach ${therapist || 'your therapist'}` : 'Appears in their Payments to verify',
      status: done && notified ? 'done' : 'waiting', startOffsetMs: s.saveEndMs ?? 0, durationMs: done && notified ? Math.max(0, (s.sendEndMs ?? 0) - (s.saveEndMs ?? 0)) : null,
    },
  ]
}
