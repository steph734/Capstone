// Central security guard for the whole API (api/index.js installs it in front of every route).
//
//   1. sanitizeQuery  - blocks MongoDB-operator / object injection through the URL query string
//                       (?email[$ne]=x), the same way hardening.js already does for JSON bodies.
//   2. apiGuard       - DEFAULT DENY. Every /api route needs a valid sign-in unless it is on the short
//                       PUBLIC list below (login, signup, password reset ...). It then applies:
//                         - role rules for admin-type routes,
//                         - "you can only act as yourself": an email in the URL/body must be the signed-in
//                           user's own email (so changing ?email= can't read someone else's data),
//                         - rate limits on routes that cost money (SMS, email, text-to-speech) or can be brute-forced.
//
// To open a new public route, add it to PUBLIC on purpose; everything else is private automatically.
import { requireSession, getClientIp } from './session.js'
import { tooManyRequests } from './rateLimit.js'

// ── 1. query-string sanitising ───────────────────────────────────────────────
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Query values must be plain strings (or lists of strings). Anything else (nested objects such as
// {"$ne": ""}) is dropped, and so is any key that starts with "$".
export function sanitizeQuery(req, res, next) {
  const raw = req.query
  if (raw && typeof raw === 'object') {
    const clean = {}
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('$') || BAD_KEYS.has(k)) continue
      if (typeof v === 'string') clean[k] = v
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) clean[k] = v
    }
    // Express 5 exposes req.query as a read-only getter, so define our own copy on the request.
    Object.defineProperty(req, 'query', { value: clean, writable: true, configurable: true, enumerable: true })
  }
  next()
}

// ── 2. who may call what ────────────────────────────────────────────────────
// Routes that work without a session. Each one either IS the sign-in flow, authenticates itself another way
// (a booking token, Stripe's signature, the cron secret, a one-time link) or is public information.
const PUBLIC = [
  /^\/api\/server-time$/,
  /^\/api\/auth\/(signup|verify-otp|resend-otp|login|verify-login-otp|send-reset-otp|verify-reset-otp|reauth|logout)$/,
  /^\/api\/reset-password$/, // needs the signed one-time reset token
  /^\/api\/set-password\/[^/]+$/, // needs the emailed one-time invite token
  /^\/api\/verify-credentials$/, // part of sign-in (rate limited below)
  /^\/api\/stripe\/webhook$/, // verified with Stripe's signature
  /^\/api\/bookings\//, // each call needs the booking token (header x-booking-token); expire-holds needs the cron secret
  /^\/api\/payments\//, // payment attempts: own token / therapist checks inside
  /^\/api\/attendance\/remind$/, // cron secret
  /^\/api\/branches$/, // branch names for the sign-up form
  /^\/api\/games\/(list|by-name)$/, // public game catalog
  // Loaded by <img src>, which cannot send an Authorization header. The ids are unguessable.
  /^\/api\/patient-photos\/[^/]+$/,
  /^\/api\/employees\/[^/]+\/photo$/,
  /^\/api\/game-assets\/[^/]+$/,
]

// Only these roles may use these routes (the route's own checks still apply on top).
const ADMIN = ['Owner', 'Super Admin']
const CLINICAL = ['Therapist', 'Owner', 'Super Admin']
const ROLE_RULES = [
  { re: /^\/api\/badges\/(create|[^/]+)$/, notGet: true, roles: ADMIN },
  { re: /^\/api\/pao-(items|hair)\/(create|[^/]+)$/, notGet: true, roles: ADMIN },
  { re: /^\/api\/pao-themes\/[^/]+$/, notGet: true, roles: ADMIN },
  { re: /^\/api\/exercises\//, roles: CLINICAL },
  { re: /^\/api\/(patients|appointments)\/therapist-list$/, roles: CLINICAL },
  { re: /^\/api\/therapist\/gamified\//, roles: CLINICAL },
  { re: /^\/api\/(send-appointment-sms|send-trial-reminder)$/, roles: ['Patient', 'Therapist', 'Owner', 'Super Admin'] },
]

// Parameters that name "the person making this request". They must match the signed-in user.
// (patientEmail is NOT here: a therapist legitimately asks about their patients.)
const SELF_KEYS = ['email', 'therapistEmail', 'employeeEmail', 'adminEmail', 'callerEmail']
// These routes check ownership themselves and legitimately take other people's emails.
// On the payment/receipt routes below `email` is the BILLING / RECIPIENT address, which a user may set to something other
// than their login email, so it is not compared (they still need a sign-in and are rate limited).
const SKIP_SELF_CHECK = [
  /^\/api\/attendance\//, /^\/api\/employees(\/|$)/, /^\/api\/owner\//, /^\/api\/admin\//,
  /^\/api\/(create-payment-intent|create-setup-intent|create-subscription|send-receipt|send-trial-reminder|send-appointment-confirmation)$/,
]

// Rate limits: [path regex, key prefix, max, window]. Keyed per signed-in user (or per IP for pre-login routes).
const MIN = 60 * 1000
const LIMITS = [
  { re: /^\/api\/tts$/, name: 'tts', max: 60, windowMs: 10 * MIN },
  { re: /^\/api\/(send-appointment-sms|send-appointment-confirmation|send-receipt|send-trial-reminder)$/, name: 'notify', max: 10, windowMs: 60 * MIN },
  { re: /^\/api\/auth\/(signup|resend-otp|send-reset-otp)$/, name: 'auth-mail', max: 8, windowMs: 15 * MIN, byIp: true },
  { re: /^\/api\/auth\/(verify-otp|verify-reset-otp|verify-login-otp)$/, name: 'auth-otp', max: 20, windowMs: 15 * MIN, byIp: true },
  { re: /^\/api\/(reset-password|verify-credentials)$/, name: 'auth-misc', max: 20, windowMs: 15 * MIN, byIp: true },
  { re: /^\/api\/auth\/change-password$/, name: 'pw-change', max: 10, windowMs: 15 * MIN },
  { re: /^\/api\/(create-payment-intent|create-setup-intent|create-subscription)$/, name: 'pay', max: 30, windowMs: 15 * MIN },
]

const lower = (v) => String(v || '').trim().toLowerCase()

export async function apiGuard(req, res, next) {
  try {
    if (req.method === 'OPTIONS') return next()
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path
    if (!path.startsWith('/api/')) return next()

    const limit = LIMITS.find((l) => l.re.test(path))
    const isPublic = PUBLIC.some((re) => re.test(path))

    // Pre-login routes can only be limited by IP.
    if (isPublic && limit && (await tooManyRequests(res, `${limit.name}:${getClientIp(req)}`, limit))) return
    if (isPublic) return next()

    // Everything else needs a real, unexpired, unrevoked session. (The 15-minute idle lock is still enforced by the
    // routes that hold clinical notes; here it must not block the lock screen's own "re-enter your password" call.)
    const ctx = await requireSession(req, res, { idle: false, touch: false })
    if (!ctx) return
    req.sessionCtx = ctx
    const role = ctx.user.role

    const rule = ROLE_RULES.find((r) => r.re.test(path) && (!r.notGet || !['GET', 'HEAD'].includes(req.method)))
    if (rule && !rule.roles.includes(role)) {
      return res.status(403).json({ error: 'You do not have access to this.', code: 'FORBIDDEN' })
    }

    if (!SKIP_SELF_CHECK.some((re) => re.test(path))) {
      const me = lower(ctx.user.email)
      for (const src of [req.query, req.body]) {
        if (!src || typeof src !== 'object') continue
        for (const key of SELF_KEYS) {
          const v = src[key]
          if (typeof v === 'string' && v.trim() && lower(v) !== me) {
            return res.status(403).json({ error: 'You can only act on your own account.', code: 'FORBIDDEN' })
          }
        }
      }
    }

    if (limit && (await tooManyRequests(res, `${limit.name}:${limit.byIp ? getClientIp(req) : String(ctx.user._id)}`, limit))) return
    return next()
  } catch (err) {
    console.error('apiGuard error:', err.message)
    return res.status(500).json({ error: 'Could not verify your request.' })
  }
}
