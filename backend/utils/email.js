// Thin wrapper over the Brevo (formerly Sendinblue) Transactional Email API (v3).
// Mirrors frontend/api/_lib/brevo.js but in CommonJS for the Express backend.
//   POST https://api.brevo.com/v3/smtp/email   header: api-key: <API key>
//
// The API key and the verified sender address come from env vars only.
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

// Env values pasted into a dashboard often arrive with wrapping quotes or a
// stray newline — strip those so a copy-paste slip doesn't read as "unset".
function readEnv(name) {
  const raw = process.env[name];
  if (raw == null) return '';
  return String(raw).trim().replace(/^["']|["']$/g, '').trim();
}

async function sendEmail({ to, toName, subject, html, plain }) {
  const apiKey = readEnv('BREVO_API_KEY');
  const fromAddress = readEnv('BREVO_FROM_ADDRESS');

  if (!apiKey || !fromAddress) {
    const missing = [
      !apiKey && 'BREVO_API_KEY',
      !fromAddress && 'BREVO_FROM_ADDRESS',
    ].filter(Boolean);
    throw new Error(
      `Brevo env not configured on the backend — missing: ${missing.join(', ')}. ` +
      'Add them to backend/.env (BREVO_FROM_ADDRESS must be a verified sender).'
    );
  }

  const fromName = readEnv('BREVO_FROM_NAME') || 'TherapyPro';

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromAddress, name: fromName },
      to: [toName ? { email: to, name: toName } : { email: to }],
      subject,
      htmlContent: html,
      textContent: plain,
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  // A successful send returns 201 Created (202 if scheduled) with a messageId.
  if (res.status === 201 || res.status === 202) {
    return { referenceId: data.messageId || null };
  }

  const detail = data.message || data.code || `HTTP ${res.status}`;
  throw new Error(`Brevo send failed: ${detail}`);
}

module.exports = { sendEmail };
