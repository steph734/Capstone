// Small security middleware for the API (api/index.js uses all three, in this order).
import helmet from 'helmet'

// 1. Standard security headers (nosniff, no framing, HSTS, no referrer leaks ...).
//    CSP is left to vercel.json because the API only returns JSON.
export const securityHeaders = helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } })

// 2. Only our own website may send changes to the API.
//    Browsers attach an Origin header to cross-site requests. A POST/PATCH/DELETE whose Origin is
//    neither this site nor in ALLOWED_ORIGINS (comma separated, optional) is refused. The site and the
//    API share one Vercel domain, so normal use never trips this. Calls with no Origin (server to server,
//    cron jobs) pass, and they still need a valid session token to do anything private.
export function sameSiteOnly(req, res, next) {
  const origin = req.headers.origin
  if (!origin || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  let host = ''
  try { host = new URL(origin).host } catch { /* malformed Origin falls through to refusal */ }
  const allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (host && (host === req.headers.host || allowed.includes(origin))) return next()
  return res.status(403).json({ error: 'Cross-site request refused.' })
}

// 3. Strip MongoDB operators ("$gt", "$ne" ...) from request bodies, so a JSON body like
//    { "email": { "$ne": null } } can never act as a database query.
export function stripMongoOperators(value) {
  if (Array.isArray(value)) return value.map(stripMongoOperators)
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, stripMongoOperators(v)]))
  }
  return value
}
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = stripMongoOperators(req.body)
  next()
}
