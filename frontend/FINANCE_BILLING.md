# Sales / Billing: Invoices and Expenses

Owner → Sales / Billing has two real, MongoDB-backed features:

* **Invoices** (money in): patient invoices only. Tab *Invoices*.
* **Expenses** (money out): utility bills, supplies, other clinic costs. Tab *Expenses*.

They never mix: expenses are not invoices and an invoice never lists a clinic cost. Revenue, Payouts and *How you get paid*
tabs are unchanged (the clinic-details card on *How you get paid* is new and feeds invoice headers).

## One-time setup

```
node scripts/finance-setup.mjs                     # DRY RUN: prints what it would do, writes nothing
node scripts/finance-setup.mjs --apply             # creates invoices + financial_audit_logs, indexes, seeds
node scripts/finance-setup.mjs --apply --apply-collmod   # ALSO runs the payments change below
```

Idempotent and safe to re-run (collections only if missing, seeds use `$setOnInsert`). It never drops or recreates
`expenses` or `vendors`. It seeds the vendors *Davao Light* (Electricity) and *Davao City Water District* (Water), the
counters (`invoice_no` starts so the first invoice is INV-1001; `expense_BILL/INT/RENT/SUP/EXP` for BILL-0001…) and one
`clinic_settings` document.

**One change to an existing collection (required for "Mark paid" on invoices).** `payments` only allowed
`payment_for = appointment | subscription`. Add `invoice` and an optional `invoice_id`: the script prints the exact
`collMod` command; run it in mongosh/Compass (or use `--apply-collmod`). Existing documents are unaffected. Until it
runs, marking an invoice paid fails cleanly with `PAYMENTS_SCHEMA_OUTDATED` and the invoice stays Pending.

## Rules that hold everywhere

* Money is integer **centavos**; rounded once per line, half away from zero. The server recomputes every total,
  consumption and line amount and returns `422 TOTAL_MISMATCH` if a client-sent value disagrees.
* Dates are BSON dates at 00:00 **Asia/Manila**. "Today", overdue and "in N days" use Manila. Range filters are inclusive
  (00:00:00 to 23:59:59.999 Manila).
* *Overdue* is never stored (unpaid and due before today, Manila).
* Nothing financial is deleted: **void** stores who, when and why; voided records leave all totals.
* Owner and Super Admin only (403 otherwise). Owners see all branches (decision: the Owner is not linked to a branch in the
  database); every list accepts `branch_id`.
* Every create / send / mark paid / void is written to `financial_audit_logs` (who, when, action, record id; no request bodies).

## Endpoints (all under `/api/owner`, Bearer session)

| Invoices | |
|---|---|
| `GET /invoices?status=Paid\|Pending\|Overdue\|Draft\|Void&q=&issued_from=&issued_to=&due_from=&due_to=&invoice_type=&branch_id=&page=&limit=` | list |
| `GET /invoices/summary` (same filters) | KPI cards + segment counts |
| `POST /invoices` (header `Idempotency-Key`; body `send:true` = Create & send) | create (201; same key returns the original, 200) |
| `GET /invoices/:id`, `PATCH /invoices/:id` (Draft only) | read / edit |
| `POST /invoices/:id/send`, `/remind` (once / 24 h), `/mark-paid`, `/void` | actions |
| `GET /invoices/:id/pdf` | server-generated PDF (behind the session) |
| `GET /invoices/patients?q=` | patient search for the modal |
| `GET /patients/:id/billable-sessions?from=&to=` | completed, unbilled, unpaid sessions |

| Expenses and vendors | |
|---|---|
| `GET /expenses?expense_type=&utility_type=&payment_status=Unpaid\|Paid\|Overdue&from=&to=&q=&category=&branch_id=&page=&limit=` | list |
| `GET /expenses/summary` | KPI cards + segment counts |
| `POST /expenses`, `GET/PATCH /expenses/:id` (Unpaid only) | create / read / edit |
| `POST /expenses/:id/mark-paid`, `/void`, `/next-rent` | actions (`next-rent` only on recurring rent) |
| `POST /expenses/:id/attachments` (multipart `file`), `GET /expenses/:id/attachments/:index` | PDF/JPG/PNG, 5 MB, max 5, magic-byte checked, served only through the session |
| `GET /expenses/previous-bill?utility_type=&branch_id=` | for the "vs last bill" note |
| `GET/POST /vendors?vendor_type=&utility_type=&q=` | biller dropdown / add vendor |
| `GET/PUT /clinic` | clinic details for invoice headers |

Errors use one shape: `{ error, code, fields? }`. Codes: `NO_SESSION` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`VALIDATION_ERROR` 422 (+`fields`), `TOTAL_MISMATCH` 422, `INVALID_DATE_RANGE` 422, `SESSION_ALREADY_BILLED` 409,
`INVOICE_NOT_PAYABLE` 409, `INVOICE_NOT_EDITABLE` 409, `INVOICE_NOT_VOIDABLE` 409, `ALREADY_PAID` 409, `ALREADY_VOID` 409,
`REMINDER_TOO_SOON` 429, `FILE_TOO_LARGE` 413, `UNSUPPORTED_FILE` 415, `EMAIL_FAILED` (flag on create/send; 502 on remind).

## Behaviour worth knowing

* **Create & send** saves the invoice as Pending first, then emails it (Brevo, with the PDF). If the email fails the invoice is
  kept, `sent_at` stays empty and the list shows "Not sent, retry".
* **A session can be on one live invoice**: enforced by a partial unique index on `billed_appointment_ids` (Draft, Pending,
  Paid). Voiding frees the sessions. Sessions already paid online are not offered for billing.
* **Mark paid** writes the invoice and a `payments` row in one MongoDB transaction (amount in pesos there, as the existing
  collection stores it).
* **Reminders**: an expense with "remind me N days before due" gets one in-app notification + email to the Owner on that day,
  from a daily Vercel Cron (`/api/expenses/remind`, 00:00 UTC = 08:00 Manila, locked behind `CRON_SECRET`).
* **Recurring rent** is never created silently: the Owner clicks *Create next month's rent* on the bill.
* **Add to inventory**: no inventory collection exists, so only the flag is stored.
* **Save draft** on an expense is kept in the browser (the `expenses` validator has no draft status). Invoice drafts are real.

## Environment variables

`MONGO_URI` (existing; never printed), `SESSION_SECRET`, `BREVO_API_KEY` + `BREVO_FROM_ADDRESS` (+ `BREVO_FROM_NAME`) for email,
`CRON_SECRET` for the reminder cron. `CLINIC_TIMEZONE` defaults to `Asia/Manila`.

## Tests

```
npx vitest run api/_lib/finance.test.js api/_lib/finance.api.test.js src/pages/owner/billing   # no database needed
FINANCE_INTEGRATION=1 npx vitest run api/_lib/finance.integration.test.js                       # real MongoDB
```

The integration suite creates a throwaway database `therapypro_test_<timestamp>` on the cluster in `MONGO_URI`, copies the
**live** validators of `expenses`, `vendors` and `payments` into it, runs concurrency, transaction/rollback, validator and
reminder tests, and drops it at the end. The real `therapypro` database is only read.

## Per-branch TIN and invoice details

Each branch has its own TIN and invoice details, stored on the existing `branchs` collection (no longer in `clinic_settings`):
`tin`, `billing_email`, `website`, `payment_instructions`, `default_invoice_terms`. All are optional; the live validator's patterns
and limits are mirrored on the client and the server. Only the clinic **name** stays clinic-wide.

* **Super Admin, Branches page.** Add / Edit branch has a *Tax & billing* section (the TIN auto-formats as 000-000-000-00000). The TIN
  is required only to set a branch **Active** (422 `TIN_REQUIRED_FOR_ACTIVE`), is unique across branches (409 `DUPLICATE_TIN`, naming
  the branch), and an Active branch that has one cannot lose it. Older Active branches without a TIN stay editable; their cards show an
  amber "No TIN yet · Add TIN". Changing an Active branch's TIN asks for confirmation. Blank optional fields are omitted on insert and
  unset on update, never saved as `""`. MongoDB validator errors (code 121) come back as 422 `VALIDATION_ERROR`.
* **Audit.** Every change to a billing field writes who / when / branch / field / old / new to `audit_logs` (mirrored to `auditlogs`).
* **Owner, How you get paid → Clinic details on invoices: VIEW ONLY.** Pick one of *your* branches (`branchs.owner_id` = your user id;
  the Super Admin sees all); the picker shows each branch's TIN or an amber "No TIN yet". Values are read-only text with a lock (no
  inputs, no Save button). Every write method on `/api/owner/billing/branches` (and the old `PUT /api/owner/clinic`) is a 403
  `FORBIDDEN`; another owner's branch is a 404. The clinic name is `clinic_settings._id 'clinic'`.`clinic_name` (clinic-wide); there is
  currently no screen where anyone edits it.
* **Invoices.** The header, payment instructions and default terms come from the invoice's branch (the patient's branch) and are copied
  onto the invoice as `clinic_snapshot`, so later branch edits never change an old invoice. A branch with no TIN cannot create or send an
  invoice (422 `BRANCH_TIN_MISSING`).

| Endpoint | |
|---|---|
| `GET /api/admin/branches`, `GET /api/admin/branches/:id` | include `tin, billingEmail, website, paymentInstructions, defaultInvoiceTerms` |
| `POST /api/admin/branches`, `PATCH /api/admin/branches/:id` | accept the same five fields (Super Admin only; unknown fields rejected) |
| `GET /api/owner/billing/branches`, `GET /api/owner/billing/branches/:id` | the Owner's branches (read only; any write is 403) |

### One-time database steps (not run for you)

```
node scripts/branch-tin-migration.mjs                        # DRY RUN: lists branches without a TIN, shows the old clinic TIN, prints the commands
node scripts/branch-tin-migration.mjs --apply-status-enum    # collMod: adds Draft + Declined to branchs.status (Save as draft / Decline need it)
node scripts/branch-tin-migration.mjs --apply-index          # unique partial index on tin
node scripts/branch-tin-migration.mjs --assign-owner=<userId> --apply   # sets owner_id on branches that have none
```

Unique TIN index (mongosh), only created when you run it:

```
db.branchs.createIndex({ tin: 1 }, { unique: true, name: 'uniq_branch_tin', partialFilterExpression: { tin: { $exists: true } } })
```

The old clinic-level TIN (`clinic_settings.business_tin` = "45665767", 8 digits) does **not** match the branch pattern and is never
copied. Set each branch's real TIN from Branches → Edit branch, or use the commented `updateOne` templates the script prints.

Tests: `npx vitest run api/_lib/branchBilling.test.js src/pages/admin/branches` and
`FINANCE_INTEGRATION=1 npx vitest run api/_lib/branchBilling.integration.test.js` (throwaway database, real handlers, dropped afterwards).
