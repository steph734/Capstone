const { sendEmail } = require('./email');

const BRAND = 'TherapyPro';

function buildApplicationReceivedHtml({ name }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Application received</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 16px;font-size:14px;">
          Thanks for joining ${BRAND}. Your details and documents have been submitted and are now
          being processed for review.
        </p>

        <p style="margin:0 0 20px;font-size:14px;">
          You can expect a decision within <strong>2–3 working days</strong>. We'll be in touch once
          your application has been reviewed.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          If you weren't expecting this email, you can ignore it.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildApplicationReceivedText({ name }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Thanks for joining ${BRAND}. Your details and documents have been submitted and are now being processed for review.`,
    'You can expect a decision within 2-3 working days.',
    '',
    "If you weren't expecting this email, you can ignore it.",
  ].join('\n');
}

async function sendApplicationReceivedEmail({ email, name }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `Your ${BRAND} application is being processed`,
    html: buildApplicationReceivedHtml({ name }),
    plain: buildApplicationReceivedText({ name }),
  });
}

module.exports = { sendApplicationReceivedEmail };
