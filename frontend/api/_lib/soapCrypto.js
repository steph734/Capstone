// AES-256-GCM encryption for SOAP note text, plus the content hash and input
// rules for the four SOAP fields. Server only: SOAP_ENCRYPTION_KEY must never
// be exposed to the browser (no VITE_ prefix), and plaintext only leaves this
// module for an authorised read.
import crypto from 'node:crypto'

export const SOAP_FIELDS = ['subjective', 'objective', 'assessment', 'plan']
export const SOAP_MIN = 10
export const SOAP_MAX = 5000

function httpError(status, message, code) {
  const e = new Error(message)
  e.status = status
  if (code) e.code = code
  return e
}

// 32 bytes, given as 64 hex chars or base64. Fails closed: with no key (or a
// malformed one) nothing is written and nothing is decrypted.
function getKey() {
  const raw = String(process.env.SOAP_ENCRYPTION_KEY || '').trim()
  if (!raw) throw httpError(500, 'Note encryption is not configured on the server (SOAP_ENCRYPTION_KEY).', 'NO_ENC_KEY')
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw httpError(500, 'SOAP_ENCRYPTION_KEY must be 32 bytes (64 hex characters).', 'BAD_ENC_KEY')
  return key
}

// Ciphertext format: v1.<iv>.<tag>.<data> (base64url). The note id and field
// name are bound in as additional authenticated data, so a ciphertext copied
// to another note or field fails to decrypt instead of silently showing.
const aad = (noteId, field) => Buffer.from(`${noteId}:${field}`)

export function encryptField(plain, noteId, field) {
  if (plain === null || plain === undefined || plain === '') return plain ?? null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  cipher.setAAD(aad(noteId, field))
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.')
}

export const isEncrypted = (v) => typeof v === 'string' && v.startsWith('v1.') && v.split('.').length === 4

export function decryptField(blob, noteId, field) {
  if (blob === null || blob === undefined || blob === '') return blob ?? null
  // Legacy rows written before encryption was added are plaintext.
  if (!isEncrypted(blob)) return String(blob)
  const [, iv, tag, data] = blob.split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'))
  decipher.setAAD(aad(noteId, field))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

// SHA-256 over the canonical content of the note (what the therapist signed).
export function contentHash(fields) {
  const canonical = JSON.stringify(SOAP_FIELDS.map((k) => fields[k] ?? ''))
  return crypto.createHash('sha256').update(canonical).digest('hex')
}
export function addendumHash({ reason, text }) {
  return crypto.createHash('sha256').update(JSON.stringify([reason ?? '', text ?? ''])).digest('hex')
}

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Strips control characters (keeps tab/newline), trims, escapes HTML.
export function cleanText(s) {
  return escapeHtml(String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
}
const rawLength = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().length

// Validates the four SOAP fields. `complete` = signing: all four required,
// 10–5000 characters each. A draft may leave fields empty but never exceeds
// the maximum. Returns { errors, value } where value holds the escaped text.
export function validateSoap(body, { complete }) {
  const errors = {}
  const value = {}
  let any = false
  for (const f of SOAP_FIELDS) {
    const len = rawLength(body?.[f])
    if (len > SOAP_MAX) errors[f] = `Keep this to ${SOAP_MAX} characters.`
    else if (complete && len < SOAP_MIN) errors[f] = len === 0 ? 'This section is required.' : `Write at least ${SOAP_MIN} characters.`
    if (len > 0) any = true
    value[f] = len > 0 ? cleanText(body[f]) : ''
  }
  if (!complete && !any) errors.subjective = 'Write something before saving a draft.'
  return { errors, value }
}

export function validateReason(reason) {
  const len = rawLength(reason)
  if (len < 10) return { error: 'Give a reason of at least 10 characters.' }
  if (len > 1000) return { error: 'Keep the reason to 1000 characters.' }
  return { value: cleanText(reason) }
}
