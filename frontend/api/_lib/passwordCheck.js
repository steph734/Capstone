// Shared failed-attempt accounting: five wrong passwords (or wrong login
// codes) in a row lock the account for five minutes. Used by the login routes
// and by password re-entry (signing a note, unlocking an idle session), so a
// stolen session can't be used to guess the password without limit.
import bcrypt from 'bcryptjs'
import { revokeSession } from './session.js'
import { audit } from './noteAccess.js'

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
// ── Signing a note / adding an addendum ───────────────────────────────────────────
// Signing has its OWN counter (collection `sign_attempts`), separate from the login lock:
//   * every wrong password is written to the audit trail ("sign_failed")
//   * 5 wrong passwords lock SIGNING for 15 minutes ("sign_locked"); the user can still log in
//   * a correct password resets the counter
// So a stolen, still-open session cannot be used to guess the password.
export const SIGN_MAX_FAILED = 5
export const SIGN_LOCK_MS = 15 * 60 * 1000

export async function checkSigningPassword(db, user, passwordHash, { ip = null, patientId = null, noteId = null } = {}) {
  const col = db.collection('sign_attempts')
  const now = new Date()
  const row = await col.findOne({ user_id: user._id })

  if (row?.lock_until && row.lock_until > now) {
    const mins = Math.max(1, Math.ceil((row.lock_until.getTime() - now.getTime()) / 60000))
    await audit(db, { user, action: 'sign_failed', patientId, noteId, ip, meta: { reason: 'signing locked' } })
    return { ok: false, locked: true, error: `Signing is locked for ${mins} more minute${mins === 1 ? '' : 's'} after too many wrong passwords.` }
  }
  if (!passwordHash || typeof passwordHash !== 'string') return { ok: false, error: 'Enter your password to continue.' }

  if (await bcrypt.compare(passwordHash, user.password)) {
    if (row) await col.deleteOne({ user_id: user._id })
    return { ok: true }
  }

  const before = row && !(row.lock_until && row.lock_until <= now) ? row.attempts || 0 : 0
  const attempts = before + 1
  const locked = attempts >= SIGN_MAX_FAILED
  await col.updateOne(
    { user_id: user._id },
    { $set: { attempts: locked ? 0 : attempts, lock_until: locked ? new Date(now.getTime() + SIGN_LOCK_MS) : null, last_failed_at: now } },
    { upsert: true },
  )
  const left = Math.max(0, SIGN_MAX_FAILED - attempts)
  await audit(db, { user, action: 'sign_failed', patientId, noteId, ip, meta: { attemptsLeft: left } })
  if (locked) await audit(db, { user, action: 'sign_locked', patientId, noteId, ip, meta: { minutes: SIGN_LOCK_MS / 60000 } })
  return {
    ok: false,
    locked,
    error: locked ? 'Too many wrong passwords. Signing is locked for 15 minutes.' : `Incorrect password. ${left} attempt${left === 1 ? '' : 's'} left.`,
  }
}

export { revokeSession }
