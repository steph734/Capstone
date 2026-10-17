// Fire-and-forget mirror of a call-state change into `call_logs`. Never blocks the call UI.
// Only the caller writes (the server ignores duplicate 'end' events for the same call).
export function logCall(action, streamCallId, extra) {
  fetch('/api/stream/call-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, streamCallId, ...extra }),
  }).catch(() => {})
}
