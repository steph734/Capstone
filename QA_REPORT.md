# TherapyPro — QA & Security Report

Date: 2026-11-15 · Branch: `frontend` · Scope: frontend (React/Vite + Vercel API in `frontend/api`), Express backend (`backend/`), MongoDB layer.

**Method:** automated checks (lint, unit tests, production build, `npm audit`, secret scan of files and git history) plus manual code review of auth, access control, uploads, and DB models.
**Not covered:** no live penetration test, no browser/E2E run, and no connection to the live MongoDB Atlas cluster (the DB review is of schemas, queries and git history only).

## Summary

| Area | Result |
|---|---|
| Production build | PASS (51 PWA precache entries) |
| Unit tests | PASS: 214/214 tests, but only with `--pool=forks` (see QA-01) |
| Lint (oxlint) | 0 errors, ~45 warnings |
| `npm audit` frontend | 6 vulns: 4 moderate, 2 low (all via `vite-plugin-pwa`/`workbox-build`, build-time only) |
| `npm audit` backend | 0 vulns |
| Secrets in tracked files | None found in current files |
| Secrets in git history | **FOUND** (`backend/.env`) |

Findings: **1 Critical · 3 High · 5 Medium · 6 Low/QA**

---

## Security findings

### SEC-01 CRITICAL — Database credentials committed to git history
`backend/.env` was committed (commit `eaccd65`, "Add backend", 2026-07-02) and removed in `c0fb490`. It contained a full `MONGO_URI` for the Atlas cluster (user `asantiago546574_db_user`, with password). Deleting the file doesn't remove it from history; anyone with repo access can recover it with `git show eaccd65:backend/.env`.
**Fix:** rotate that Atlas database user's password now, and check Atlas Network Access (no `0.0.0.0/0`). Then optionally purge the history (`git filter-repo`) and force-push. Rotation is the part that matters.

### SEC-02 HIGH — Express email routes trust a client-supplied `?email=` (IDOR)
`backend/routes/emails.js` identifies the caller through `resolveCaller(req.query.email)` / `req.body.email` (`backend/lib/emailAuth.js`) and never compares it with the signed-in user (`req.auth`). Any signed-in user can read, star, trash or download attachments from another user's mailbox by changing the email parameter. The code comment in `emailAuth.js` ("no session/token auth anywhere") is also outdated now that `requireAuth` exists. The Vercel API (`frontend/api/_lib/guard.js`) already does this check correctly, so the Express copy is the gap.
**Fix:** derive the caller from `req.auth.user.email` and ignore the client value.

### SEC-03 HIGH — `/api/verify-credentials` (public) stores and compares plaintext passwords
`frontend/api/_lib/credentialStore.js` + `routes/verify-credentials.js`: the "forgot password" prototype stores the password in Vercel KV (`pwreset:<email>`) and checks `stored.password === password`. It is a public route, uses non-constant-time comparison, and works as an account-existence oracle (the response carries the role). Passwords sit in the KV store in plain form (or SHA-256 only, which is unsalted and fast to crack).
**Fix:** retire this path in favour of the real bcrypt-backed `auth-login`/`reset-password` flow, or at minimum hash with bcrypt and use `timingSafeEqual`.

### SEC-04 HIGH — Client-side SHA-256 "pre-hash" makes the hash the password
`backend/routes/auth.js` (`change-password` comment, login, signup) receives passwords pre-hashed with SHA-256 by the browser, then bcrypts that. A leaked DB hash can't be reversed, but the SHA-256 value is itself a valid credential for login (pass-the-hash), and the server cannot enforce a password policy: `password.length < 8` (line 77) is always satisfied by a 64-char hash, so weak passwords are accepted. Weak passwords are also cheap to brute force offline if the bcrypt hash leaks.
**Fix:** send the password over TLS and let the server enforce length/complexity, then bcrypt it.

### SEC-05 MEDIUM — `/api/auth/change-password` bypasses account lockout
`backend/routes/auth.js:358`: not behind `requireAuth`, identifies the user only by email, and checks the current password with no per-account attempt counter. The 3-strike lockout applies only to `/login`, so an attacker can guess passwords here, limited only by the per-IP limiter (30 per 15 min).
**Fix:** require a session and reuse the lockout counter.

### SEC-06 MEDIUM — Lockout can be used to lock out other users (DoS)
Every failed login for a locked account keeps resetting `lock_until` (auth.js:276–279). An attacker can keep any known email locked indefinitely. Consider locking per account+IP or not extending the lock while it is active.

### SEC-07 MEDIUM — OTP handling
`UserOtp.code` is stored in plaintext and compared with `!==` (auth.js:164). Attempts are incremented with a read-modify-write (`otp.attempts += 1; save()`), so concurrent requests can exceed `OTP_MAX_ATTEMPTS`. A 6-digit code is brute-forceable if those races are exploited. **Fix:** store a hash of the code, use an atomic `$inc`, compare with `timingSafeEqual`.

### SEC-08 MEDIUM — Account enumeration
`verify-otp` and `change-password` return 404 "No account found for that email", login returns distinct 423 (locked) vs 401, and signup returns "email/username already registered". Use uniform responses where practical.

### SEC-09 MEDIUM — Two parallel auth stacks
The Express backend's `/login` issues no session token (it relies on tokens minted by the Vercel API) and duplicates logic that already lives in `frontend/api`. Two implementations means fixes (like SEC-02) land in only one. Decide which one is authoritative and retire the other.

### SEC-10 LOW — Public endpoints
`GET /api/branches` and `GET /api/games` are unauthenticated by design (sign-up form, game catalog); acceptable, but confirm no sensitive fields are returned.

### SEC-11 LOW — Demo credentials documented in repo
`frontend/LOGIN_CREDENTIALS.md` and `src/utils/accounts.js` list `owner123`, `superadmin123`, etc. Good: the passwords are compiled out of production builds unless `VITE_ENABLE_DEMO_ACCOUNTS=true`. Make sure that flag is **not** set in Vercel, and that no real DB user shares these emails/passwords.

### SEC-12 LOW — Uploads trust the client MIME type
Multer `fileFilter` checks `file.mimetype` only (employees, staffSetup, emails). A file can claim `application/pdf` and be anything. Files are served from GridFS with `Content-Disposition: inline` and the stored type, so a mislabelled HTML upload is a stored-XSS risk if served from the app's origin. **Fix:** sniff magic bytes and serve with `attachment` + `X-Content-Type-Options: nosniff` (helmet already sets nosniff).

### SEC-13 LOW — Dependency advisories (frontend)
6 advisories, all transitive via `vite-plugin-pwa → workbox-build → glob/minimatch/rollup plugins`. Build-time only, not shipped to users. Run `npm audit fix` / bump `vite-plugin-pwa` when a patched release is available.

### Positives worth keeping
Helmet + CSP headers on Vercel, HSTS, rate limiting on auth routes, NoSQL-operator stripping on body and query, fail-closed `requireAuth`, HMAC-signed sessions backed by a revocable DB row with 15-min idle lock, default-deny API guard with self-email enforcement, bcrypt, hashed invite tokens, secrets in `.gitignore`, backend `npm audit` clean.

---

## Bugs / QA findings

### QA-01 — Test runner crashes with default settings
`npx vitest run` fails all 22 files with `TypeError: Cannot read properties of undefined (reading 'config')` (default worker-thread pool). With `--pool=forks` every test loads and **214/214 pass**. Add `test: { pool: 'forks' }` to `vite.config.js` and add a `"test"` script to `package.json` (none exists).

### QA-02 — 3 test files report "No test suite found"
`api/_lib/paoProgression.test.mjs`, `api/_lib/sessionRecommendations.test.mjs`, `src/components/sortplace/sortLogic.test.mjs` use `node:test`, not vitest. They pass under node (11/11 for sortLogic) but vitest counts them as failures. Exclude `*.test.mjs` in the vitest config and run them with `node --test`.

### QA-03 — Duplicate object key bug in attendance reminders
`api/_lib/routes/attendance-remind.js:44`: `email: { $exists: true, $ne: null, $ne: '' }`. The second `$ne` overwrites the first, so employees with a `null` email are not excluded. Use `$nin: [null, '']`.

### QA-04 — Backend has no tests
`backend/package.json` test script is `echo "Error: no test specified" && exit 1`. The auth, lockout, OTP, upload and access-control logic (the riskiest code) has zero coverage.

### QA-05 — `node_modules` is tracked in git
10,187 files under the repo-root `node_modules/` are committed (root `.gitignore` doesn't exclude it as tracked). This bloats the repo and can leak platform binaries. `git rm -r --cached node_modules` and add `node_modules/` to `.gitignore`.

### QA-06 — Lint warnings (≈45, none blocking)
Real ones to look at: missing/incorrect hook deps (`OwnerProfilePage.jsx:64`, `PatientProfilePage.jsx:71`, `OwnerBillingPage.jsx:66-71`, `ChooseNextSetModal.jsx:36`, `SendGamesHomePage.jsx:64` (`useMemo` depends on a value that changes every render), `PatientEmailPage.jsx:119`); `no-unused-expressions` at `CheckoutModal.jsx:440`, `PatientProgressPage.jsx:46`, `CopyColors.jsx:289`; unused state `setShowConfirm` (`AppointmentsPage.jsx:109`), `emailError`/`smsError` (`BookAppointmentPage.jsx:255,259`, so those errors are never shown to the user). The rest are unused vars and fast-refresh export warnings.

---

## Database review (schema/code level only)

- Unique indexes exist on `users.email` and `users.username`. The code comment says "case-insensitive" but a plain unique index is case-sensitive. Emails are lowercased in code, usernames are not (`Admin` and `admin` can both register). Add a collation (`{ locale: 'en', strength: 2 }`) or lowercase usernames.
- `user_otps` has a TTL-style index on `otp_expires_at`. Fine, but codes are plaintext (SEC-07).
- No `strict`/validator issues found, but `employees` relies on an Atlas-side validator whose enum values must match code exactly (noted in `employees.js`), which makes schema drift easy. Keep the validator in the repo.
- Staff ID documents (PRC/PTR/ID) live in GridFS; access is limited to Owner/Super Admin in Express, which is good. Check Atlas encryption-at-rest and backups are enabled, since this is sensitive personal data.
- **Not verified:** actual collection contents, Atlas network rules, DB user privileges, backup status. Needs access to the Atlas console.

---

## Recommended order of work
1. **Today:** rotate the Atlas DB password (SEC-01).
2. Fix the email IDOR (SEC-02) and gate/hash `verify-credentials` (SEC-03).
3. Move password policy server-side (SEC-04), lock down `change-password` (SEC-05), harden OTP (SEC-07).
4. Fix the test config (QA-01/02), the `$ne` bug (QA-03), untrack `node_modules` (QA-05).
5. Add backend tests for auth and access control (QA-04).
