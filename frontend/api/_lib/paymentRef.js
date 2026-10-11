// TherapyPro's own 8-digit payment reference number — separate from
// `reference_number`, which already holds the external gateway id
// (Stripe/GCash transaction id). `payment_ref` is ours: shown to the
// patient on the receipt and in the confirmation email, and searchable by
// staff. Generated server-side only, once, at insert — never on update,
// refund or status change, and never accepted from the client.
import crypto from 'crypto'

// 10000000-99999999: always exactly 8 digits, never starts with 0.
export function makePaymentRef() {
  return String(crypto.randomInt(10000000, 100000000))
}

// Inserts a payment document with a guaranteed-unique payment_ref. Relies on
// the unique partial index on payments.payment_ref to decide uniqueness —
// never "check then insert" (a race) — and retries on a duplicate-key error
// (11000) with a new number. `doc` must not already carry payment_ref or
// created_at/updated_at; those are set here.
export async function insertPaymentWithRef(paymentsCollection, doc, maxTries = 8) {
  // Defensive: a client can never set its own reference, no matter what
  // the caller passed in.
  const { payment_ref: _ignored, ...safeDoc } = doc
  for (let i = 0; i < maxTries; i++) {
    const payment_ref = makePaymentRef()
    const now = new Date()
    const toInsert = { ...safeDoc, payment_ref, created_at: safeDoc.created_at || now, updated_at: now }
    try {
      const res = await paymentsCollection.insertOne(toInsert)
      return { _id: res.insertedId, ...toInsert }
    } catch (err) {
      if (err.code === 11000 && /payment_ref/.test(err.message || '')) continue
      throw err
    }
  }
  throw new Error('Could not generate a unique payment reference number.')
}
