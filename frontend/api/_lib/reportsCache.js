// ~60 second cache for Owner Reports summaries, keyed per (owner, range, comparison).
// In-memory, so it is per server instance; invalidateReportsCache() runs whenever a payment is recorded
// (see insertPaymentWithRef) so new money shows up on the next load.
const TTL_MS = 60 * 1000
const store = new Map()

export function cacheGet(key) {
  const hit = store.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) { store.delete(key); return null }
  return hit.value
}

export function cacheSet(key, value) {
  if (store.size > 200) store.clear()
  store.set(key, { value, expires: Date.now() + TTL_MS })
}

export function invalidateReportsCache() {
  store.clear()
}
