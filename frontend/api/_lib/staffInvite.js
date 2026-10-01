// ESM port of backend/utils/staffInvite.js — same token scheme used by
// set-password.js, so a link this issues still works there.
import crypto from 'crypto'

// How long a setup link stays valid.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// The raw token goes in the emailed link; only its hash is ever stored, so a
// leaked database row can't be replayed as a working invite.
export function generateInviteToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashInviteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
