import { getStripeClient, findCustomerByEmail } from './stripeClient.js'
import { getDb, getMongo } from './mongo.js'

// Every payment Stripe has on file for this billing email — subscription
// invoice charges and one-off PaymentIntent charges alike — normalised into
// a small shape the UI can render directly. Read-only.
export async function getPaymentHistory({ email, limit = 100 }) {
  const stripe = getStripeClient()
  const customer = await findCustomerByEmail(stripe, email)

  if (!customer) {
    // No customer yet == no payments. Not an error.
    return { customerId: null, payments: [] }
  }

  const charges = await stripe.charges.list({
    customer: customer.id,
    limit: Math.min(Math.max(Number(limit) || 100, 1), 100),
  })

  // TherapyPro's own payment_ref lives on our `payments` doc, keyed by the
  // Stripe charge/PaymentIntent id we saved as `reference_number` when the
  // payment was first recorded (see api/_lib/receiptEmail.js). Best-effort:
  // a charge with no matching doc (e.g. recorded before this feature) just
  // shows no reference rather than breaking the page.
  let refByExternalId = new Map()
  try {
    await getMongo()
    const db = await getDb()
    const externalIds = charges.data.map((c) => c.id).filter(Boolean)
    if (externalIds.length) {
      const docs = await db.collection('payments').find(
        { reference_number: { $in: externalIds } },
        { projection: { reference_number: 1, payment_ref: 1 } }
      ).toArray()
      refByExternalId = new Map(docs.map((d) => [d.reference_number, d.payment_ref || null]))
    }
  } catch (err) {
    console.error('getPaymentHistory: could not look up payment_ref:', err)
  }

  const payments = charges.data.map((c) => {
    const card = c.payment_method_details?.card
    return {
      id: c.id,
      paymentRef: refByExternalId.get(c.id) || null,
      amount: c.amount, // smallest currency unit (centavos)
      amountRefunded: c.amount_refunded,
      currency: (c.currency || 'php').toUpperCase(),
      status: c.refunded ? 'refunded' : c.status, // succeeded | pending | failed | refunded
      paid: c.paid,
      created: c.created, // unix seconds
      description: c.description || c.calculated_statement_descriptor || 'Payment',
      cardBrand: card?.brand || null,
      cardLast4: card?.last4 || null,
      receiptUrl: c.receipt_url || null,
      invoiceId: typeof c.invoice === 'string' ? c.invoice : c.invoice?.id || null,
      failureMessage: c.failure_message || null,
    }
  })

  return { customerId: customer.id, payments }
}
