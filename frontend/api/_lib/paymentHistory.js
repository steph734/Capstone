import { getStripeClient, findCustomerByEmail } from './stripeClient.js'

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

  const payments = charges.data.map((c) => {
    const card = c.payment_method_details?.card
    return {
      id: c.id,
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
