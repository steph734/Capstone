const crypto = require('crypto');
const { sendEmail } = require('./email');

const BRAND = 'TherapyPro';

// How long a setup link stays valid.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// The raw token goes in the emailed link; only its hash is ever stored, so a
// leaked database row can't be replayed as a working invite.
function generateInviteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashInviteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildInviteHtml({ name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">You've been added to ${BRAND}</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 20px;font-size:14px;">
          Your account has been created. Click below to upload your PTR, PRC
          license, diploma, and a valid ID — the owner will review them and
          activate your account.
        </p>

        <p style="margin:0 0 20px;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;
            text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;
            border-radius:10px;">
            Upload Documents
          </a>
        </p>

        <p style="margin:0 0 8px;font-size:12px;color:#6b7c75;">
          Or paste this link into your browser:<br/>
          <span style="word-break:break-all;color:#159a72;">${link}</span>
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          This link expires in 7 days. If you weren't expecting this, you can ignore
          this email.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function buildInviteText({ name, link }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Your account has been created. Use this link to upload your documents:`,
    link,
    '',
    'This link expires in 7 days.',
    "If you weren't expecting this, you can ignore this email.",
  ].join('\n');
}

async function sendStaffInviteEmail({ email, name, link }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `You've been added to ${BRAND} — upload your documents`,
    html: buildInviteHtml({ name, link }),
    plain: buildInviteText({ name, link }),
  });
}

module.exports = {
  INVITE_TTL_MS,
  generateInviteToken,
  hashInviteToken,
  sendStaffInviteEmail,
};
