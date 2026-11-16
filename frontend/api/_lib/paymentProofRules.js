// Pure rules for QR payment proof (reference number + receipt image). No imports, so the SERVER (validation) and the
// BROWSER (inline hints) use exactly the same rules.

// How long a slot is held for an online (QR) payment. The ONE setting behind "Held 72 hrs" everywhere.
export const PAYMENT_HOLD_HOURS = 72
export const PAYMENT_HOLD_MS = PAYMENT_HOLD_HOURS * 60 * 60 * 1000
// The patient is reminded when the hold has this long left and no proof was sent yet.
export const HOLD_REMINDER_HOURS = 12

// Reference number rules per wallet, keyed by the payment method id the API uses.
// GCash prints a 13-digit "Ref No." (shown as 5456 656 574 544). Maya's format is not fixed, so it accepts 10 to 16 digits.
export const REFERENCE_RULES = {
  gcash: { label: 'GCash', min: 13, max: 13, groups: [4, 3, 3, 3], where: 'You can find it on your GCash receipt, under "Ref No."', error: 'Reference numbers have 13 digits' },
  paymaya: { label: 'Maya', min: 10, max: 16, groups: [4, 4, 4, 4], where: 'You can find it on your Maya receipt, under "Reference ID".', error: 'Maya reference numbers have 10 to 16 digits' },
}
const ruleFor = (method) => REFERENCE_RULES[method] || REFERENCE_RULES.gcash

export const normalizeReference = (raw) => String(raw ?? '').replace(/\D/g, '')

// "5456656574544" -> "5456 656 574 544"
export function formatReference(raw, method) {
  const digits = normalizeReference(raw)
  const groups = ruleFor(method).groups
  const out = []
  let i = 0
  for (const g of groups) { if (i >= digits.length) break; out.push(digits.slice(i, i + g)); i += g }
  if (i < digits.length) out.push(digits.slice(i))
  return out.join(' ')
}

// -> { ok, digits, display, last4, count, error }   (error is a ready sentence for the patient)
export function validateReference(raw, method) {
  const rule = ruleFor(method)
  const digits = normalizeReference(raw)
  if (!digits) return { ok: false, digits, display: '', last4: '', count: 0, error: 'Reference number is required.', code: 'PROOF_REQUIRED' }
  if (digits.length < rule.min || digits.length > rule.max) return { ok: false, digits, display: formatReference(digits, method), last4: digits.slice(-4), count: digits.length, error: rule.error, code: 'INVALID_REFERENCE' }
  return { ok: true, digits, display: formatReference(digits, method), last4: digits.slice(-4), count: digits.length, error: '', code: null }
}

// ── receipt image ──
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
export const RECEIPT_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' }

// Reads the first bytes of the file itself: "jpg" | "png" | null. The MIME type the browser sends is never trusted.
export function detectImageType(bytes) {
  const b = bytes
  if (!b || b.length < 8) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  return null
}

// -> { ok, code, error }   `bytes` is optional (the first bytes of the file) and is checked when given.
export function validateReceiptMeta({ size, bytes } = {}) {
  if (!size) return { ok: false, code: 'PROOF_REQUIRED', error: 'Upload a screenshot of your receipt.' }
  if (size > MAX_RECEIPT_BYTES) return { ok: false, code: 'FILE_TOO_LARGE', error: 'That image is larger than 5 MB. Choose a smaller screenshot.' }
  if (bytes && !detectImageType(bytes)) return { ok: false, code: 'INVALID_FILE_TYPE', error: 'Only JPG or PNG images are allowed.' }
  return { ok: true, code: null, error: '' }
}

export const formatBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// ── status vocabulary ──
// The database keeps the attempt statuses the app already used (created / pending_verification / succeeded / ...).
// This is the name the API and the screens use for the same thing.
export function paymentStatusOf(attempt) {
  const s = attempt?.status
  if (s === 'created' || s === 'processing' || s === 'requires_action') return 'awaiting_payment'
  if (s === 'pending_verification') return 'proof_submitted'
  if (s === 'succeeded') return 'verified'
  if (s === 'rejected') return 'rejected'
  if (s === 'expired' || attempt?.failure_code === 'timeout') return 'expired'
  if (s === 'cancelled') return 'cancelled'
  return 'failed'
}

export const REJECT_REASONS = ["Amount didn't arrive", 'Wrong amount', 'Reference not found', 'Other']
