import { getStripeClient } from './stripeClient.js'
import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'

function formatMoney(amountMinor, currency) {
  const value = (amountMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const cur = (currency || 'php').toUpperCase()
  return cur === 'PHP' ? `₱${value}` : `${value} ${cur}`
}

function buildReceiptHtml({ brand, amount, dateStr, description, cardLine, receiptUrl, referenceNo }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Payment receipt</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">Thank you for your payment to ${brand}.</p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">Description</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">${description}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">Date</td>
            <td style="padding:8px 0;text-align:right;">${dateStr}</td>
          </tr>
          ${cardLine ? `<tr><td style="padding:8px 0;color:#6b7c75;">Payment method</td><td style="padding:8px 0;text-align:right;">${cardLine}</td></tr>` : ''}
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">Reference</td>
            <td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px;">${referenceNo}</td>
          </tr>
          <tr>
            <td style="padding:14px 0 0;border-top:2px solid #e8f5f0;font-weight:700;font-size:16px;">Amount paid</td>
            <td style="padding:14px 0 0;border-top:2px solid #e8f5f0;text-align:right;font-weight:700;font-size:16px;">${amount}</td>
          </tr>
        </table>

        ${
          receiptUrl
            ? `<p style="margin:22px 0 0;"><a href="${receiptUrl}" style="display:inline-block;background:#2c4a3e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;">View Stripe receipt</a></p>`
            : ''
        }

        <p style="margin:22px 0 0;color:#9aab9f;font-size:11px;">This payment was processed securely by Stripe. If you did not make this payment, contact support immediately.</p>
      </div>
    </div>
  </body>
</html>`
}

function buildReceiptText({ brand, amount, dateStr, description, cardLine, receiptUrl, referenceNo }) {
  return [
    `${brand} — Payment receipt`,
    '',
    `Description: ${description}`,
    `Date: ${dateStr}`,
    cardLine ? `Payment method: ${cardLine}` : null,
    `Reference: ${referenceNo}`,
    `Amount paid: ${amount}`,
    receiptUrl ? `\nStripe receipt: ${receiptUrl}` : null,
    '',
    'This payment was processed securely by Stripe.',
  ]
    .filter(Boolean)
    .join('\n')
}

// Verifies the PaymentIntent really succeeded at Stripe, then emails a
// receipt for it to `email` via Brevo. Safe to call fire-and-forget from
// the client — it re-checks status server-side and never trusts the caller.
export async function sendSubscriptionReceipt({ email, name, paymentIntentId }) {
  if (!email) throw new Error('Missing email')
  if (!paymentIntentId) throw new Error('Missing paymentIntentId')

  const stripe = getStripeClient()
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  })

  if (pi.status !== 'succeeded') {
    throw new Error(`PaymentIntent is not succeeded (status: ${pi.status})`)
  }

  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null
  const card = charge?.payment_method_details?.card
  const created = (charge?.created || pi.created) * 1000

  const view = {
    brand: BRAND,
    amount: formatMoney(pi.amount_received || pi.amount, pi.currency),
    dateStr: new Date(created).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    description: pi.description || charge?.description || `${BRAND} subscription`,
    cardLine: card ? `${card.brand} ···· ${card.last4}` : null,
    receiptUrl: charge?.receipt_url || null,
    referenceNo: pi.id,
  }

  const { referenceId } = await sendEmail({
    to: email,
    toName: name,
    subject: `Your ${BRAND} payment receipt — ${view.amount}`,
    html: buildReceiptHtml(view),
    plain: buildReceiptText(view),
  })

  return { sent: true, referenceId, amount: view.amount, receiptUrl: view.receiptUrl }
}
