import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'

function formatMoney(amount) {
  const value = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `₱${value}`
}

function buildHtml({ brand, planName, priceStr, endDateStr, daysPhrase, manageUrl }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Your free trial ends ${daysPhrase}</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">
          Your ${brand} <strong>${planName}</strong> 7-day free trial is almost over.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">Plan</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">${brand}: ${planName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">Trial ends</td>
            <td style="padding:8px 0;text-align:right;">${endDateStr}</td>
          </tr>
          <tr>
            <td style="padding:14px 0 0;border-top:2px solid #e8f5f0;font-weight:700;font-size:16px;">Then you pay</td>
            <td style="padding:14px 0 0;border-top:2px solid #e8f5f0;text-align:right;font-weight:700;font-size:16px;">${priceStr}/month</td>
          </tr>
        </table>

        <p style="margin:20px 0 0;font-size:13px;color:#2c4a3e;">
          To keep your ${planName} features, add a payment method before the trial ends. If you don&rsquo;t
          subscribe, your account moves back to the Free plan and the premium features are locked until you pay
          the regular monthly price.
        </p>

        ${
          manageUrl
            ? `<p style="margin:22px 0 0;"><a href="${manageUrl}" style="display:inline-block;background:#2c4a3e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;">Subscribe now</a></p>`
            : ''
        }

        <p style="margin:22px 0 0;color:#9aab9f;font-size:11px;">
          You&rsquo;re receiving this because you started a free trial on ${brand}. No charge has been made yet.
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildText({ brand, planName, priceStr, endDateStr, daysPhrase, manageUrl }) {
  return [
    `${brand} — your ${planName} free trial ends ${daysPhrase}`,
    '',
    `Plan: ${brand}: ${planName}`,
    `Trial ends: ${endDateStr}`,
    `Then you pay: ${priceStr}/month`,
    '',
    `To keep your ${planName} features, add a payment method before the trial ends. If you don't subscribe,`,
    `your account moves back to the Free plan and the premium features are locked until you pay the regular`,
    `monthly price.`,
    manageUrl ? `\nSubscribe now: ${manageUrl}` : null,
    '',
    `No charge has been made yet.`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Emails the user that their 7-day free trial is about to end and that the
// regular monthly price applies afterwards. Fire-and-forget from the client;
// the client de-dupes so this is sent once per trial.
export async function sendTrialEndingEmail({ email, name, planName, price, trialEndsAt, manageUrl }) {
  if (!email) throw new Error('Missing email')
  if (!planName) throw new Error('Missing planName')

  const end = new Date(trialEndsAt)
  if (Number.isNaN(end.getTime())) throw new Error('Invalid trialEndsAt')

  const msLeft = end.getTime() - Date.now()
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
  const daysPhrase = daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`

  const view = {
    brand: BRAND,
    planName,
    priceStr: formatMoney(price),
    endDateStr: end.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    daysPhrase,
    manageUrl: manageUrl || null,
  }

  const { referenceId } = await sendEmail({
    to: email,
    toName: name,
    subject: `Your ${BRAND} ${planName} free trial ends ${daysPhrase} — then ${view.priceStr}/month`,
    html: buildHtml(view),
    plain: buildText(view),
  })

  return { sent: true, referenceId, daysLeft }
}
