// Session check for the Express backend. It accepts the SAME signed tokens the Vercel API issues
// (frontend/api/_lib/session.js): an HMAC-SHA256 token signed with SESSION_SECRET, backed by a row in the
// shared MongoDB `sessions` collection. Set the same SESSION_SECRET (32+ chars) in backend/.env.
const crypto = require('crypto');
const mongoose = require('mongoose');

const IDLE_LOCK_MS = 15 * 60 * 1000;

function secret() {
  const s = String(process.env.SESSION_SECRET || '').trim();
  return s.length >= 32 ? s : null;
}

function verifyToken(token) {
  const key = secret();
  if (!key) return null;
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', key).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}

// requireAuth()            -> any signed-in user
// requireAuth(['Owner'])   -> only those roles
// Fails closed: with no SESSION_SECRET configured every protected route answers 500, never "open".
function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      if (!secret()) return res.status(500).json({ error: 'Server auth is not configured (SESSION_SECRET).' });
      const header = String(req.headers.authorization || '');
      const payload = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
      if (!payload || !payload.sid || payload.exp < Date.now() || !mongoose.isValidObjectId(payload.sid)) {
        return res.status(401).json({ error: 'Please sign in again.', code: 'NO_SESSION' });
      }
      const db = mongoose.connection.db;
      if (!db) return res.status(503).json({ error: 'Database not connected yet.' });
      const session = await db.collection('sessions').findOne({ _id: new mongoose.Types.ObjectId(payload.sid) });
      if (!session || session.revoked || session.expires_at < new Date()) {
        return res.status(401).json({ error: 'Your session has ended. Please sign in again.', code: 'NO_SESSION' });
      }
      if (Date.now() - session.last_seen.getTime() > IDLE_LOCK_MS) {
        return res.status(401).json({ error: 'Locked after 15 minutes of inactivity.', code: 'SESSION_LOCKED' });
      }
      const user = await db.collection('users').findOne({ _id: session.user_id });
      if (!user || user.is_archived || (user.is_locked && user.lock_until && user.lock_until > new Date())) {
        return res.status(403).json({ error: 'This account cannot access this right now.', code: 'ACCOUNT_BLOCKED' });
      }
      if (roles && !roles.includes(user.role)) {
        return res.status(403).json({ error: 'You do not have access to this.', code: 'FORBIDDEN' });
      }
      await db.collection('sessions').updateOne({ _id: session._id }, { $set: { last_seen: new Date() } });
      req.auth = { user, session };
      next();
    } catch (err) {
      console.error('requireAuth error:', err.message);
      res.status(500).json({ error: 'Could not verify your session.' });
    }
  };
}

module.exports = { requireAuth, verifyToken };
