# Online payment checkout: how it works, setup, and test steps

## The rule that changed
Before: the browser paid, then told the server "I paid" and the server believed it (anyone could create a "paid" booking for free, QR payments were confirmed by a checkbox, two people could pay for one slot).
Now: **the server holds the slot first, and only the server (asking Stripe, or a therapist verifying a QR payment) confirms a payment.**

## The states (right column of the modal; the left summary never changes)
```
select_method -> confirm -> processing -> success
                                       \-> failed               (Change payment method / Try again / Contact support)
                                       \-> pending_verification (GCash / Maya QR: waiting for the therapist)
```
- **Confirm:** details list (method, amount, session, therapist). QR needs the tick "I sent exactly ₱300.00 using the GCash QR code". Card shows `Card •••• 4242`.
- **Processing:** spinner, 3 live steps, amber "don't close" notice. No close button, Esc/backdrop/Back are disabled, `beforeunload` warns. After 30 s the subtitle says it is taking longer. Polls the server every 2 s for ~2 min, then every 5 s.
- **Success:** real reference number, receipt PDF, 5-second countdown to the appointment (any click cancels it).
- **Failed:** friendly reason (never a raw code), attempt details, retry buttons. If the slot was taken meanwhile: "Pick another time".
- **Pending verification:** amber clock, "usually within 24 hours", optional GCash/Maya reference number and screenshot.
- **Refresh during payment:** the booking id and secret token are kept in `sessionStorage`; reopening the page asks the server where the payment is and continues from there.

## What happens on the server
| Step | Route | What it does |
|---|---|---|
| 1 | `POST /api/bookings/start` | Creates the appointment as an **unpaid hold** (`status: Pending`, `payment_state: awaiting_payment`, `hold_expires_at` = +15 min) and **locks the slot atomically** (`slot_holds`). Same `idempotencyKey` = same booking. |
| 2 | `POST /api/bookings/:id/attempts` | Starts a payment attempt (`payment_attempts`). The amount is the **server's** (₱300). Card: creates the Stripe PaymentIntent (idempotency key to Stripe). QR: marks it waiting for the therapist. |
| 3 | Stripe.js | The browser pays (handles 3D Secure). |
| 4 | `GET /api/payments/:id/status` | Reads the PaymentIntent from **Stripe** and maps it: succeeded / processing / requires_action / failed (+friendly reason). On success the booking is confirmed (once). |
| 4b | `POST /api/stripe/webhook` | Stripe tells the server `payment_intent.succeeded / payment_failed / canceled`, so a booking is confirmed even if the tab was closed. Checks the signature and the amount received. |
| QR | `POST /api/payments/:id/review` | **The therapist who got the booking** presses "Mark as paid" or "Not received" (panel on their Appointments page). |
| Cleanup | `GET /api/bookings/expire-holds` (cron) + lazily before each new booking | Releases expired holds and cancels their unfinished attempts. A late payment after the slot was lost is refunded automatically. |

Confirming a payment (`finalizePaid`) writes the payment row with our 8-digit reference, marks the appointment `payment_state: paid`, releases the lock, then sends the email/text. A failed text (for example a missing `SEMAPHORE_API_KEY`) is only logged; the patient is never shown it.

Appointment `status` stays **Pending** after payment so the existing therapist accept/decline step is unchanged; `payment_state` (`awaiting_payment`, `pending_verification`, `paid`, `expired`, `failed`, `cancelled`) is what says whether it is paid. Held, unpaid and abandoned bookings are hidden from therapist lists, owner lists, and do not make a therapist "assigned" to a patient.

## Migration
No data migration. New collections are created automatically: `payment_attempts`, `slot_holds`, `rate_limits`. Indexes are created on first use (`payment_attempts.idempotency_key` unique, `appointments.booking_key` unique partial). Existing appointments simply have no `payment_state` and behave as before.

## Setup (one time)
1. **Env vars** (Vercel, and `frontend/.env`): `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` (already used), plus the new `STRIPE_WEBHOOK_SECRET`.
2. **Webhook:** Stripe dashboard → Developers → Webhooks → Add endpoint
   `https://<your-site>/api/stripe/webhook`, events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
3. **Redeploy.** (`vercel.json` also adds a daily cron for `/api/bookings/expire-holds`.)

## Automated tests
`npx vitest run api/_lib/payments.test.js src/utils/payments.test.js` (34 tests): friendly error mapping, Stripe-status mapping, slot lock / hold expiry, confirm-exactly-once, idempotency, server price, declined / 3D Secure / succeeded, late-payment refund, QR approve / reject, SMS failure hidden, webhook (bad signature, amount check, failed, ignored).

## Manual test steps (Stripe test mode)
Use a patient account, open `/appointments` → pick therapist and slot → `/appointments/book` → step 2 "Pay online".
| # | Do | Expect |
|---|---|---|
| 1 | Card `4242 4242 4242 4242`, any future date, any CVC → Continue | Confirm screen shows `Card •••• 4242`, amount, session, therapist |
| 2 | "Yes, confirm payment" | Processing (spinner, 3 steps, no close button) → **Payment successful!** with a real reference no., then goes to "Appointment Booked!" after 5 s. In Atlas: **one** `appointments` row (`payment_state: paid`), **one** `payments` row, one `payment_attempts` row `succeeded`. |
| 3 | Double-click "Yes, confirm payment" | Still one booking and one charge |
| 4 | Card `4000 0000 0000 0002` | **Payment unsuccessful**, "Your card was declined…", no booking confirmed (`payment_state` stays `awaiting_payment`). "Try again" and "Change payment method" work. |
| 5 | Card `4000 0025 0000 3155` | Stripe's 3D Secure window opens; **Complete** -> success, **Fail** -> failed with the 3D Secure message |
| 6 | Refresh the page while "Processing…" | The modal reopens and continues from the server's state |
| 7 | Close the tab right after paying, wait ~1 minute, check Atlas | Booking is `paid` (webhook) |
| 8 | Start a booking, leave the checkout, wait 15+ minutes | Hold released (appointment Cancelled, `payment_state: expired`), the slot is free again |
| 9 | Two patients try the same slot | The second gets "That time slot is no longer available" |
| 10 | QR: choose GCash, tick the box, confirm | **Payment submitted**, amber clock, "usually within 24 hours", **no** "successful" message, appointment stays unpaid |
| 11 | As the booked therapist: Appointments page → "Payments to verify" → **Mark as paid** | Booking becomes `paid`, patient emailed. "Not received" releases the slot and emails the patient |
| 12 | Unset `SEMAPHORE_API_KEY` and pay | Booking succeeds, no SMS error shown to the patient (check the server log) |
| 13 | After a failed payment, "Contact support" | Opens Help & Support with a new ticket pre-filled |
| 14 | API check: `POST /api/appointments/create` with `payment.method: "stripe"` | 400 "Online payments are booked through the secure checkout" |

## Known limits
- QR payments need a person to verify them (a personal GCash/Maya QR cannot be checked automatically).
- The online amount is ₱300 (the session fee, as the modal always charged). The ₱50 service charge shown on the booking summary is not part of the online charge. Change it in `api/_lib/pricing.js`.
- After a page refresh the booking form is empty, so a resumed successful payment goes to the appointments list instead of the "Appointment Booked!" page.
- `POST /api/bookings/start` has no login check (patients without a server login can still book); it is rate-limited and protected by the secret booking token instead.
