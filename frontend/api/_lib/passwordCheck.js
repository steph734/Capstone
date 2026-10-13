// Shared failed-attempt accounting: five wrong passwords (or wrong login
// codes) in a row lock the account for five minutes. Used by the login routes
// and by password re-entry (signing a note, unlocking an idle session), so a
// stolen session can't be used to guess the password without limit.
import bcrypt from 'bcryptjs'
import { revokeSession } from './session.js'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_DURATION_MS = 5 * 60 * 1000

// Records one failed attempt on a users document (native driver). Returns
// { locked, lockUntil, left }.
export async function recordFailure(db, user, { sessionId } = {}) {
  const attempts = (user.failed_login_attempts || 0) + 1
  const now = new Date()
  const set = { failed_login_attempts: attempts, last_login_attempt: now }
  const locked = attempts >= MAX_FAILED_ATTEMPTS
  if (locked) { set.is_locked = true; set.lock_until = new Date(now.getTime() + LOCK_DURATION_MS) }
  await db.collection('users').updateOne({ _id: user._id }, { $set: set })
  if (locked) {
    // Lock out every live session of this account, not just this request.
    await db.collection('sessions').updateMany({ user_id: user._id, revoked: false }, { $set: { revoked: true, revoked_at: now } })
    await db.collection('auditlogs').insertOne({
      user_id: user._id, action: 'account_locked', ip_address: 'n/a',
      description: `Account locked for 5 minutes after ${attempts} failed attempts.`, created_at: now,
    }).catch(() => {})
  }
  return { locked, lockUntil: locked ? set.lock_until : null, left: Math.max(0, MAX_FAILED_ATTEMPTS - attempts) }
}

export async function recordSuccess(db, user) {
  await db.collection('users').updateOne({ _id: user._id }, { $set: { failed_login_attempts: 0, is_locked: false, lock_until: null } })
}

// Re-entry of the password (as the same SHA-256 hex the login form sends).
export async function checkPasswordReentry(db, user, passwordHash) {
  if (!passwordHash || typeof passwordHash !== 'string') return { ok: false, error: 'Enter your password to continue.' }
  const ok = await bcrypt.compare(passwordHash, user.password)
  if (ok) { await recordSuccess(db, user); return { ok: true } }
  const f = await recordFailure(db, user)
  return {
    ok: false,
    locked: f.locked,
    error: f.locked ? 'Too many wrong passwords. This account is locked for 5 minutes.' : `Incorrect password. ${f.left} attempt${f.left === 1 ? '' : 's'} left.`,
  }
}
export { revokeSession }
