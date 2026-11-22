# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Sales / Billing (invoices and expenses)

See [FINANCE_BILLING.md](FINANCE_BILLING.md) for setup, endpoints, environment variables and tests.

## Therapist "My Patients" (`/therapist/patients`)

Code: `api/_lib/therapistPatients.js` (logic), `api/_lib/routes/therapist-patients.js` (routes), `src/pages/therapist/TherapistPatientsPage.jsx` and `src/pages/therapist/patients/` (UI).

**Endpoints** (Therapist only; the therapist is always the signed-in session's employee record, never an id from the request):
`GET /api/therapist/patients?search=&status=&needs_session=&sort=&page=&limit=`, `POST /api/therapist/patients` (header `Idempotency-Key`),
`GET /api/therapist/patients/:id`, `PATCH .../:id/archive`, `PATCH .../:id/unarchive`, `GET .../:id/delete-preview`, `DELETE .../:id` (`{ confirm_name }`),
`POST .../:id/resend-invite`, `GET /api/therapist/registration-payments/:id/receipt`. First-session payments appear in the existing `GET /api/therapist/payments`.

**Mapping of the prompt's names to the real database**

| Prompt | Real |
|---|---|
| patients.patient_id | `patients.patient_code` (`P-` + 6 chars, unique partial index). The legacy `PatientID` field is kept as is. |
| patients.therapist_id | none on `patients`. A patient is the therapist's when they have an active `patient_assign` OR a real appointment with them. |
| patients.status / archive fields | new, additive: `status` (`active`/`inactive`/`archived`), `status_before_archive`, `archived_at`, `archived_by` |
| guardians collection | none: guardian fields are embedded on `patients` (`guardian_first_name`, ...). The guardian login is a `users` row (role Patient) matched by email. |
| condition | `patients.condition` (new); older patients fall back to `appointments.condition` |
| payments (first session) | `payments` with `payment_for: 'first_session'`, status `pending` (cash) or `awaiting_verification` (QR). Amount in pesos like the rest of `payments`, plus `amount_centavos`. Receipt in `payment_receipts` (`payment_id`). |
| sessions | `appointments` (counts / last / next are computed, never stored) |

**Migration** (additive, idempotent): `node scripts/migrate-patients.mjs --dry-run`, then without the flag. It backfills `status` and `patient_code`, creates the indexes and
widens two enums on the `payments` validator (`payment_for` += `first_session`, `status` += `awaiting_verification`) with `collMod`, keeping everything else.

**Environment**: `MONGO_URI`; `PUBLIC_APP_URL` (base of the guardian "set your password" link, default `https://therapypro.app`); the existing Brevo variables for the invite email.
The first-session fee is `SESSION_FEE_PESOS` in `api/_lib/pricing.js` (there is no per-therapist rate in the database).

## Idle logout (all roles)
- 10 minutes without activity -> "Are you still there?" (Pao, 60 second countdown) -> automatic logout and `/session-expired`.
- Config: `src/config/idle.js`. Test with `VITE_IDLE_TIMEOUT_MS=20000 VITE_IDLE_WARNING_MS=10000` (and `IDLE_TIMEOUT_MS` / `IDLE_WARNING_MS` on the server).
- The server enforces it: `api/_lib/session.js` ends sessions idle longer than timeout + warning + 5 s (+30 s write throttle) with `401 SESSION_IDLE`, revokes the session and writes `audit_logs` `session_idle_logout`. `POST /api/auth/heartbeat` refreshes; `POST /api/auth/logout { reason }` records manual/idle.
- Hold the timer from a screen with `useIdleBusy('reason', active)` (uploads, payments, games and dictation already do).
- One-time DB step: `node scripts/migrate-sessions.mjs --dry-run`, then without `--dry-run`.
