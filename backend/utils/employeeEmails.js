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

function appBase() {
  const base = (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  return base || 'https://therapypro.app';
}

function loginUrl() {
  return `${appBase()}/login`;
}

function setPasswordUrl(token) {
  return `${appBase()}/set-password?token=${encodeURIComponent(token)}`;
}

function buildHiredHtml({ name, email, tempPassword, setupToken }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const link = setPasswordUrl(setupToken);
  return `<!doctype html>
<html>
  <body style="margin:0;background:#05100b;font-family:Arial,Helvetica,sans-serif;color:#e7f3ee;">
    <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
      <div style="background:#0d1a14;border:1px solid #1c2e26;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#3ddc84;">You're hired!</h1>
        <p style="margin:0 0 20px;color:#c9d8d1;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#f2faf6;">
          Congratulations, your application to join ${BRAND} has been approved. Here's your temporary
          login:
        </p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
          <tr>
            <td style="padding:14px 16px 0;background:#102820;border:1px solid #1f3b2e;border-radius:12px 12px 0 0;font-size:11px;color:#8fa89c;">Login email</td>
          </tr>
          <tr>
            <td style="padding:0 16px 14px;background:#102820;border-left:1px solid #1f3b2e;border-right:1px solid #1f3b2e;font-size:15px;font-weight:700;color:#5fd8a0;">${email}</td>
          </tr>
          <tr>
            <td style="padding:0 16px;background:#102820;border-left:1px solid #1f3b2e;border-right:1px solid #1f3b2e;font-size:11px;color:#8fa89c;">Temporary password</td>
          </tr>
          <tr>
            <td style="padding:0 16px 16px;background:#102820;border:1px solid #1f3b2e;border-top:none;border-radius:0 0 12px 12px;font-size:15px;font-weight:700;letter-spacing:0.5px;color:#f2faf6;">${tempPassword}</td>
          </tr>
        </table>

        <p style="margin:0 0 20px;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#22c55e;color:#062412;text-decoration:none;
            font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">
            Set your password
          </a>
        </p>

        <p style="margin:0;font-size:12px;line-height:1.6;color:#8fa89c;">
          This link takes you straight to setting a permanent password — you won't be able to use the
          account until you do. If you weren't expecting this email, contact your branch owner.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildHiredText({ name, email, tempPassword, setupToken }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Congratulations, your application to join ${BRAND} has been approved. Here's your temporary login:`,
    '',
    `Login email: ${email}`,
    `Temporary password: ${tempPassword}`,
    '',
    `Set your password: ${setPasswordUrl(setupToken)}`,
    '',
    "This link takes you straight to setting a permanent password — you won't be able to use the account until you do.",
    "If you weren't expecting this email, contact your branch owner.",
  ].join('\n');
}

async function sendHiredEmail({ email, name, tempPassword, setupToken }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `You're hired at ${BRAND} — set your password`,
    html: buildHiredHtml({ name, email, tempPassword, setupToken }),
    plain: buildHiredText({ name, email, tempPassword, setupToken }),
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

function buildIdCardHtml({ name }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Your staff ID card</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 16px;font-size:14px;">
          Attached is a copy of your ${BRAND} staff ID card as a PDF. Keep it handy — you can print it
          or show it on your phone to check in and out at the branch.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          If you weren't expecting this email, contact your branch owner.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildIdCardText({ name }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Attached is a copy of your ${BRAND} staff ID card as a PDF.`,
    '',
    "If you weren't expecting this email, contact your branch owner.",
  ].join('\n');
}

async function sendIdCardEmail({ email, name, pdfBase64, fileName }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `Your ${BRAND} staff ID card`,
    html: buildIdCardHtml({ name }),
    plain: buildIdCardText({ name }),
    attachments: [{ name: fileName || 'ID_Card.pdf', content: pdfBase64 }],
  });
}

function buildTimeInReminderHtml({ name }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">⏰ Time in soon</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 16px;font-size:14px;">
          Your shift starts at <strong>8:00 AM</strong>. This is a reminder to scan your staff ID at
          the branch in the next few minutes to log your time in.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          Sent automatically by ${BRAND} — if you've already timed in, you can ignore this.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildTimeInReminderText({ name }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    'Your shift starts at 8:00 AM. This is a reminder to scan your staff ID at the branch in the next few minutes to log your time in.',
    '',
    "Sent automatically by " + BRAND + " — if you've already timed in, you can ignore this.",
  ].join('\n');
}

async function sendTimeInReminderEmail({ email, name }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `Reminder: time in at 8:00 AM — ${BRAND}`,
    html: buildTimeInReminderHtml({ name }),
    plain: buildTimeInReminderText({ name }),
  });
}

function buildTimeOutReminderHtml({ name }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">⏰ Time out soon</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 16px;font-size:14px;">
          Your shift ends at <strong>5:00 PM</strong>. This is a reminder to scan your staff ID at
          the branch in the next few minutes to log your time out.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          Sent automatically by ${BRAND} — if you've already timed out, you can ignore this.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildTimeOutReminderText({ name }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    'Your shift ends at 5:00 PM. This is a reminder to scan your staff ID at the branch in the next few minutes to log your time out.',
    '',
    "Sent automatically by " + BRAND + " — if you've already timed out, you can ignore this.",
  ].join('\n');
}

async function sendTimeOutReminderEmail({ email, name }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `Reminder: time out at 5:00 PM — ${BRAND}`,
    html: buildTimeOutReminderHtml({ name }),
    plain: buildTimeOutReminderText({ name }),
  });
}

module.exports = {
  sendApplicationReceivedEmail,
  sendHiredEmail,
  sendRejectedEmail,
  sendIdCardEmail,
  sendTimeInReminderEmail,
  sendTimeOutReminderEmail,
};
