// Rate limiting that works on Vercel serverless.
//
// A normal in-memory limiter does not work here: every request can land on a different
// short-lived server instance. So the counters live in MongoDB (collection `rate_limits`),
// one small document per (key, time window), increased atomically.
//
//   if (await tooManyRequests(res, `login:${ip}`, { max: 20, windowMs: 10 * 60 * 1000 })) return
//
// When the limit is passed it answers 429 "Too many attempts" with a Retry-After header and
// returns true. Old counters delete themselves (TTL index on `expires_at`).
import { getDb } from './mongo.js'

let indexReady = false

export async function tooManyRequests(res, key, { max, windowMs }) {
  try {
    const db = await getDb()
    const col = db.collection('rate_limits')
    if (!indexReady) {
      indexReady = true
      await col.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    }
    const now = Date.now()
    const bucket = Math.floor(now / windowMs)
    const out = await col.findOneAndUpdate(
      { _id: `${key}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date((bucket + 2) * windowMs) } },
      { upsert: true, returnDocument: 'after' },
    )
    const count = (out && out.value !== undefined ? out.value : out)?.count || 1
    if (count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000))))
      res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' })
      return true
    }
  } catch (err) {
    // If the counter itself fails, do not lock everyone out: the account lock and signing lock still apply.
    console.error('rate limit check failed:', err.message)
  }
  return false
}
