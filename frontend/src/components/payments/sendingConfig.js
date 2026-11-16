// The "Sending your payment details" modal: every tunable number in ONE place.
export const SLOW_AFTER_SECONDS = 30 // switch to the "taking a bit longer" state after this long
export const STALL_SECONDS = 10 // ...or when no upload progress has arrived for this long
export const HARD_TIMEOUT_SECONDS = 180 // abort automatically after this long
export const MAX_ATTEMPTS = 3 // one try + 2 automatic retries on network errors
export const RETRY_BACKOFF_MS = 1000 // wait attempt * this before a retry
export const HANDOVER_MS = 600 // at most this long between "all done" and the success modal

export const SENDING_CONFIG = {
  slowAfterMs: SLOW_AFTER_SECONDS * 1000,
  stallMs: STALL_SECONDS * 1000,
  hardTimeoutMs: HARD_TIMEOUT_SECONDS * 1000,
  maxAttempts: MAX_ATTEMPTS,
  backoffMs: RETRY_BACKOFF_MS,
}
