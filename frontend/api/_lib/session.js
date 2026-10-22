// Server-issued sessions. The rest of this app identifies callers by an email
// the browser sends, which anyone can forge; the SOAP-note APIs instead
// require a signed bearer token that only the login routes can mint.
//
// A token is `base64url(payload).base64url(hmac)`; the payload carries only a
// session id, and every request is checked against the `sessions` collection
// (revoked? expired? idle too long?), so logging out or locking a session
// takes effect immediately on the server.
import crypto from 'node:crypto'
import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000
export const IDLE_LOCK_MS = 15 * 60 * 1000

function secret() {
  const s = String(process.env.SESSION_SECRET || '').trim()
  if (s.length < 32) {
    const e = new Error('Sessions are not configured on the server (SESSION_SECRET, 32+ characters).')
    e.status = 500
    throw e
  }
  return s
}
const b64 = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest()

export function signToken(payload) {
  const body = b64(JSON.stringify(payload))
  return `${body}.${b64(sign(body))}`
}
export function verifyToken(token) {
  const [body, mac] = String(token || '').split('.')
  if (!body || !mac) return null
  const expected = sign(body)
  const given = Buffer.from(mac, 'base64url')
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
}

export function getClientIp(req) {
  const fwd = req.headers?.['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

// Called by the login routes after the password (and, for therapists and
// owners, the emailed code) has been verified.
export async function createSession(user, req, { mfa = false } = {}) {
  const db = await getDb()
  const now = new Date()
  const { insertedId } = await db.collection('sessions').insertOne({
    user_id: user._id, role: user.role, email: user.email, mfa,
    created_at: now, last_seen: now, expires_at: new Date(now.getTime() + SESSION_TTL_MS),
    revoked: false, ip: getClientIp(req),
  })
  return signToken({ sid: String(insertedId), uid: String(user._id), exp: now.getTime() + SESSION_TTL_MS })
}

export async function revokeSession(sessionId) {
  const db = await getDb()
  await db.collection('sessions').updateOne({ _id: new ObjectId(sessionId) }, { $set: { revoked: true, revoked_at: new Date() } })
}

// Resolves the caller from the Authorization header, or sends the 401/403 and
// returns null. `idle: false` skips the idle check (used by re-authentication,
// which is how a locked session is unlocked). `touch: false` still enforces the
// idle lock but does not count the request as user activity (used by background
// sync, so it can never keep an idle session alive).
export async function requireSession(req, res, { roles, idle = true, touch = true } = {}) {
  try {
    const header = String(req.headers?.authorization || '')
    const payload = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null
    if (!payload || !payload.sid || payload.exp < Date.now()) {
      res.status(401).json({ error: 'Please sign in again.', code: 'NO_SESSION' })
      return null
    }
    const db = await getDb()
    const session = await db.collection('sessions').findOne({ _id: new ObjectId(payload.sid) })
    if (!session || session.revoked || session.expires_at < new Date()) {
      res.status(401).json({ error: 'Your session has ended. Please sign in again.', code: 'NO_SESSION' })
      return null
    }
    if (idle && Date.now() - session.last_seen.getTime() > IDLE_LOCK_MS) {
      res.status(401).json({ error: 'Locked after 15 minutes of inactivity. Enter your password to continue.', code: 'SESSION_LOCKED' })
      return null
    }
    const user = await db.collection('users').findOne({ _id: session.user_id })
    if (!user || user.is_archived || (user.is_locked && user.lock_until && user.lock_until > new Date())) {
      res.status(403).json({ error: 'This account cannot access notes right now.', code: 'ACCOUNT_BLOCKED' })
      return null
    }
    if (roles && !roles.includes(user.role)) {
      res.status(403).json({ error: 'You do not have access to this.', code: 'FORBIDDEN' })
      return null
    }
    if (idle && touch) await db.collection('sessions').updateOne({ _id: session._id }, { $set: { last_seen: new Date() } })
    return { db, user, session, ip: getClientIp(req) }
  } catch (err) {
    console.error('requireSession error:', err.message)
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not verify your session.' })
    return null
  }
}
