const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserOtp = require('../models/UserOtp');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  generateCode,
  sendOtpEmail,
} = require('../utils/otp');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function logAudit(fields) {
  try {
    await AuditLog.create({ created_at: new Date(), ...fields });
  } catch (err) {
    console.error('audit log write failed:', err.message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The sign-up form only offers these two; the other roles are created by admins.
const SIGNUP_ROLES = ['Therapist', 'Patient'];

// Generate a fresh 6-digit code for `user_id`, record it in `user_otps`, and
// email it. Any earlier unused code for the same user+purpose is soft-expired
// (not deleted) so the collection keeps a full history of codes sent. Throws
// if the email can't be sent.
async function issueOtp({ user_id, email, name, purpose = 'signup' }) {
  const code = generateCode();
  const now = Date.now();

  await UserOtp.updateMany(
    { user_id, purpose, otp_used_at: null },
    { $set: { otp_expires_at: new Date(now) } }
  );

  await UserOtp.create({
    user_id,
    code,
    purpose,
    otp_created_at: new Date(now),
    otp_expires_at: new Date(now + OTP_TTL_MS),
  });

  await sendOtpEmail({ email, name, code });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const body = req.body || {};
    const full_name = String(body.full_name || body.fullName || '').trim();
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '').trim();
    const password = String(body.password || '');

    if (!full_name || !username || !email || !role || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${SIGNUP_ROLES.join(', ')}.` });
    }

    const clash = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (clash) {
      const field = clash.email === email ? 'email' : 'username';
      return res.status(409).json({ error: `That ${field} is already registered.` });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name,
      username,
      email,
      role,
      password: password_hash,
      is_verified: false,
      status: 'Active',
    });

    // Email a verification code. If it can't be sent, roll the account back so
    // the user can retry sign-up cleanly (instead of hitting a "already
    // registered" wall with no way to verify).
    try {
      await issueOtp({ user_id: user._id, email, name: full_name });
    } catch (mailErr) {
      console.error('signup OTP send failed, rolling back user:', mailErr.message);
      await User.deleteOne({ _id: user._id }).catch(() => {});
      await UserOtp.deleteMany({ user_id: user._id, purpose: 'signup' }).catch(() => {});
      return res.status(502).json({
        error: 'Could not send the verification email. Please try again in a moment.',
      });
    }

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      email,
      message: 'We emailed you a 6-digit verification code.',
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That email or username is already registered.' });
    }
    console.error('signup error:', err);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
});

// POST /api/auth/verify-otp   body: { email, code }
router.post('/verify-otp', async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 6-digit code from your email.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'No account found for that email.' });
    }
    if (user.is_verified) {
      return res.status(200).json({ success: true, alreadyVerified: true, user: user.toSafeJSON() });
    }

    const otp = await UserOtp.findOne({ user_id: user._id, purpose: 'signup', otp_used_at: null })
      .sort({ otp_created_at: -1 });
    if (!otp) {
      return res.status(410).json({ error: 'This code has expired. Request a new one.' });
    }
    if (otp.otp_expires_at.getTime() < Date.now()) {
      return res.status(410).json({ error: 'This code has expired. Request a new one.' });
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    if (otp.code !== code) {
      otp.attempts += 1;
      await otp.save();
      const left = Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts);
      return res.status(400).json({
        error: left
          ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Incorrect code. Request a new one.',
      });
    }

    user.is_verified = true;
    await user.save();
    otp.otp_used_at = new Date();
    await otp.save();

    return res.status(200).json({ success: true, user: user.toSafeJSON() });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ error: 'Could not verify the code.' });
  }
});

// POST /api/auth/resend-otp   body: { email }
router.post('/resend-otp', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const user = await User.findOne({ email });
    // Don't reveal whether an account exists — respond the same either way.
    if (!user || user.is_verified) {
      return res.status(200).json({ success: true, message: 'If that account needs verification, a new code is on its way.' });
    }

    const existing = await UserOtp.findOne({ user_id: user._id, purpose: 'signup' })
      .sort({ otp_created_at: -1 });
    if (existing) {
      const since = Date.now() - existing.otp_created_at.getTime();
      if (since < OTP_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - since) / 1000);
        return res.status(429).json({ error: `Please wait ${wait}s before requesting another code.`, retryAfter: wait });
      }
    }

    try {
      await issueOtp({ user_id: user._id, email, name: user.full_name });
    } catch (mailErr) {
      console.error('resend-otp send failed:', mailErr.message);
      return res.status(502).json({ error: 'Could not send the email. Please try again shortly.' });
    }

    return res.status(200).json({ success: true, message: 'A new code is on its way.' });
  } catch (err) {
    console.error('resend-otp error:', err);
    return res.status(500).json({ error: 'Could not resend the code.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};
    const identifier = String(body.email || body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.is_archived) {
      return res.status(403).json({ error: 'This account has been archived.' });
    }
    const now = new Date();
    const clientIp = getClientIp(req);
    // Set once a lockout is triggered and never cleared until a login
    // succeeds, so a failure arriving after `lock_until` has passed (i.e.
    // still failing once the 5-minute lock has run out) is distinguishable
    // from a normal first-time failure.
    const wasLockedAndExpired = Boolean(user.is_locked && user.lock_until && user.lock_until <= now);

    if (user.is_locked && user.lock_until && user.lock_until > now) {
      return res.status(423).json({
        error: 'Account is temporarily locked. Try again later.',
        locked: true,
        lockUntil: user.lock_until,
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    user.last_login_attempt = now;

    if (!ok) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;

      if (wasLockedAndExpired) {
        await logAudit({
          user_id: user._id,
          action: 'login_failed_after_lockout',
          ip_address: clientIp,
          description: `Failed login for ${user.email} after a previous 5-minute account lockout had already expired.`,
        });
      }

      if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
        const alreadyLocked = user.is_locked;
        user.is_locked = true;
        user.lock_until = new Date(now.getTime() + LOCK_DURATION_MS);
        if (!alreadyLocked) {
          await logAudit({
            user_id: user._id,
            action: 'account_locked',
            ip_address: clientIp,
            description: `Account locked for 5 minutes after ${user.failed_login_attempts} failed login attempts.`,
          });
        }
      }

      await user.save();
      const locked = user.is_locked && user.lock_until > now;
      return res.status(locked ? 423 : 401).json({
        error: locked
          ? 'Too many failed attempts. Account locked for 5 minutes.'
          : 'Invalid email or password.',
        locked,
        lockUntil: locked ? user.lock_until : undefined,
      });
    }

    // Credentials are right, but the email was never confirmed — issue a fresh
    // code and send them to the verification screen instead of logging in.
    if (!user.is_verified) {
      await user.save(); // persist last_login_attempt
      try {
        const existing = await UserOtp.findOne({ user_id: user._id, purpose: 'signup' })
          .sort({ otp_created_at: -1 });
        const stale = !existing || Date.now() - existing.otp_created_at.getTime() >= OTP_RESEND_COOLDOWN_MS;
        if (stale) await issueOtp({ user_id: user._id, email: user.email, name: user.full_name });
      } catch (mailErr) {
        console.error('login OTP re-send failed:', mailErr.message);
      }
      return res.status(403).json({
        error: 'Please verify your email to continue. We just sent you a 6-digit code.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // A newly-approved hire's password is only a temp one mailed to them —
    // block sign-in until they've used the "Set your password" link to
    // replace it with one only they know.
    if (user.must_set_password) {
      return res.status(403).json({
        error: 'Please set your password using the link we emailed you before signing in.',
        mustSetPassword: true,
      });
    }

    // A therapist invited via Add Staff isn't a real login until the owner
    // approves their reviewed documents — even if they somehow got a
    // password set (e.g. via password reset), block sign-in until then.
    if (user.role === 'Therapist') {
      const employee = await Employee.findOne({ user_id: user._id }).select('approved_at').lean();
      if (!employee || !employee.approved_at) {
        return res.status(403).json({
          error: "Your account is still awaiting the owner's approval. You'll be notified once it's active.",
        });
      }
    }

    user.failed_login_attempts = 0;
    user.is_locked = false;
    user.lock_until = null;
    user.last_login = now;
    await user.save();

    return res.status(200).json({ success: true, user: user.toSafeJSON() });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Could not sign you in.' });
  }
});

// POST /api/auth/change-password   body: { email, currentPassword, newPassword }
// Both passwords arrive pre-hashed with SHA-256 client-side, same convention
// as login/signup/reset — see the comment in frontend/src/utils/hash.js.
router.post('/change-password', async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Lets the caller fall back to the local (no-DB demo account) path.
      return res.status(404).json({ error: 'No account found for that email.' });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.password_change_at = new Date();
    await user.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('change-password error:', err);
    return res.status(500).json({ error: 'Could not update your password.' });
  }
});

module.exports = router;
