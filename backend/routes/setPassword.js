const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { hashInviteToken } = require('../utils/staffInvite');

const router = express.Router();

// Looks up a non-expired "set your password" link by its raw token. Returns
// the User doc (with the hash + password selected) or null.
async function findByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const hash = hashInviteToken(token);
  return User.findOne({
    password_setup_token_hash: hash,
    password_setup_expires_at: { $gt: new Date() },
  }).select('+password_setup_token_hash');
}

// GET /api/set-password/:token -> basic info for the "First login as ..." screen.
router.get('/:token', async (req, res) => {
  try {
    const user = await findByToken(req.params.token);
    if (!user) {
      return res.status(410).json({ error: 'This link is invalid or has expired.' });
    }
    return res.json({ name: user.full_name, email: user.email });
  } catch (err) {
    console.error('get set-password error:', err);
    return res.status(500).json({ error: 'Could not load this link.' });
  }
});

// POST /api/set-password/:token   body: { password }
router.post('/:token', async (req, res) => {
  try {
    const password = String((req.body || {}).password || '');
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must include a number or symbol.' });
    }

    const user = await findByToken(req.params.token);
    if (!user) {
      return res.status(410).json({ error: 'This link is invalid or has expired.' });
    }

    const sameAsTemp = await bcrypt.compare(password, user.password);
    if (sameAsTemp) {
      return res.status(400).json({ error: 'Choose a password different from the temporary one.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.must_set_password = false;
    user.password_change_at = new Date();
    user.password_setup_token_hash = undefined;
    user.password_setup_expires_at = undefined;
    await user.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('post set-password error:', err);
    return res.status(500).json({ error: 'Could not set your password.' });
  }
});

module.exports = router;
