const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserOtp = require('../models/UserOtp');
const {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  generateCode,
  sendOtpEmail,
} = require('../utils/otp');

const router = express.Router();

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
    if (user.is_locked && user.lock_until && user.lock_until > new Date()) {
      return res.status(423).json({ error: 'Account is temporarily locked. Try again later.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    user.last_login_attempt = new Date();

    if (!ok) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password.' });
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

    user.failed_login_attempts = 0;
    user.last_login = new Date();
    await user.save();

    return res.status(200).json({ success: true, user: user.toSafeJSON() });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Could not sign you in.' });
  }
});

module.exports = router;
