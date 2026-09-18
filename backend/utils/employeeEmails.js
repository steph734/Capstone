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

function loginUrl() {
  const base = (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  return `${base || 'https://therapypro.app'}/login`;
}

function buildHiredHtml({ name, email, tempPassword }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">You're hired!</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 16px;font-size:14px;">
          Congratulations — your application to join ${BRAND} has been approved. Here are your login
          details:
        </p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
          <tr>
            <td style="padding:10px 14px;background:#f0fbf5;border:1px solid #c8eeda;border-radius:10px 10px 0 0;font-size:12px;color:#6b7c75;">Login email</td>
          </tr>
          <tr>
            <td style="padding:0 14px 10px;background:#f0fbf5;border-left:1px solid #c8eeda;border-right:1px solid #c8eeda;font-size:15px;font-weight:700;color:#1a2e26;">${email}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px 0;background:#f0fbf5;border-left:1px solid #c8eeda;border-right:1px solid #c8eeda;font-size:12px;color:#6b7c75;">Temporary password</td>
          </tr>
          <tr>
            <td style="padding:0 14px 14px;background:#f0fbf5;border:1px solid #c8eeda;border-top:none;border-radius:0 0 10px 10px;font-size:15px;font-weight:700;letter-spacing:1px;color:#1a2e26;">${tempPassword}</td>
          </tr>
        </table>

        <p style="margin:0 0 20px;text-align:center;">
          <a href="${loginUrl()}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
            font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">
            Log in to ${BRAND}
          </a>
        </p>

        <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#4a6b5d;">
          For your security, please log in with this temporary password and set your own password
          right away from your account Settings.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          If you weren't expecting this email, please contact your branch owner.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildHiredText({ name, email, tempPassword }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Congratulations — your application to join ${BRAND} has been approved.`,
    '',
    `Login email: ${email}`,
    `Temporary password: ${tempPassword}`,
    '',
    `Log in at: ${loginUrl()}`,
    '',
    'For your security, please log in with this temporary password and set your own password right away from your account Settings.',
  ].join('\n');
}

async function sendHiredEmail({ email, name, tempPassword }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `You're hired at ${BRAND} — your login details`,
    html: buildHiredHtml({ name, email, tempPassword }),
    plain: buildHiredText({ name, email, tempPassword }),
  });
}

// The reason/note come from a free-text owner input, unlike the other emails
// here — escape before dropping them into HTML.
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRejectedHtml({ name, reason, note }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Application update</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 16px;font-size:14px;">
          Thank you for your interest in joining ${BRAND}. After reviewing your application, we've
          decided not to move forward at this time.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
          <tr>
            <td style="padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px 10px ${note ? '0 0' : '10px 10px'};font-size:12px;color:#991b1b;">Reason</td>
          </tr>
          <tr>
            <td style="padding:0 14px 14px;background:#fef2f2;border:1px solid #fecaca;border-top:none;border-radius:${note ? '0 0 0 0' : '0 0 10px 10px'};font-size:14px;font-weight:700;color:#7f1d1d;">${escapeHtml(reason)}</td>
          </tr>
          ${note ? `
          <tr>
            <td style="padding:10px 14px 0;background:#fef2f2;border-left:1px solid #fecaca;border-right:1px solid #fecaca;font-size:12px;color:#991b1b;">Additional details</td>
          </tr>
          <tr>
            <td style="padding:0 14px 14px;background:#fef2f2;border:1px solid #fecaca;border-top:none;border-radius:0 0 10px 10px;font-size:13px;color:#7f1d1d;">${escapeHtml(note)}</td>
          </tr>` : ''}
        </table>

        <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#4a6b5d;">
          We appreciate the time you put into your application and encourage you to apply again in
          the future.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          If you weren't expecting this email, you can ignore it.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildRejectedText({ name, reason, note }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Thank you for your interest in joining ${BRAND}. After reviewing your application, we've decided not to move forward at this time.`,
    '',
    `Reason: ${reason}`,
    note ? `Additional details: ${note}` : null,
    '',
    'We appreciate the time you put into your application and encourage you to apply again in the future.',
  ].filter(Boolean).join('\n');
}

async function sendRejectedEmail({ email, name, reason, note }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `Update on your ${BRAND} application`,
    html: buildRejectedHtml({ name, reason, note }),
    plain: buildRejectedText({ name, reason, note }),
  });
}

module.exports = { sendApplicationReceivedEmail, sendHiredEmail, sendRejectedEmail };
