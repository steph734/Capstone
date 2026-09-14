const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Branch = require('../models/Branch');
const { hashInviteToken } = require('../utils/staffInvite');

const router = express.Router();

const DOC_KEYS = ['ptr', 'prc', 'diploma', 'id'];
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_MIME.has(file.mimetype));
  },
});

// Looks up a non-expired, unused invite by its raw token. Returns the
// Employee doc (with invite_token_hash selected) or null.
async function findByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const hash = hashInviteToken(token);
  return Employee.findOne({
    invite_token_hash: hash,
    invite_expires_at: { $gt: new Date() },
  }).select('+invite_token_hash');
}

// GET /api/staff-setup/:token -> basic info for the welcome screen.
router.get('/:token', async (req, res) => {
  try {
    const employee = await findByToken(req.params.token);
    if (!employee) {
      return res.status(410).json({ error: 'This setup link is invalid or has expired.' });
    }
    const branch = await Branch.findById(employee.branch_id).select('branch_name').lean();
    return res.json({
      name: [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' '),
      email: employee.email,
      position: employee.position,
      branch_name: branch?.branch_name || '',
    });
  } catch (err) {
    console.error('get staff-setup error:', err);
    return res.status(500).json({ error: 'Could not load this invite.' });
  }
});

// POST /api/staff-setup/:token/complete -> sets the password, stores the 4
// uploaded documents in GridFS, and activates the account.
router.post(
  '/:token/complete',
  upload.fields(DOC_KEYS.map((key) => ({ name: key, maxCount: 1 }))),
  async (req, res) => {
    try {
      const employee = await findByToken(req.params.token);
      if (!employee) {
        return res.status(410).json({ error: 'This setup link is invalid or has expired.' });
      }

      const password = String(req.body?.password || '');
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      // multer's fileFilter silently drops any file with a disallowed mimetype,
      // so a bad-type upload shows up here the same way a missing one does.
      const files = req.files || {};
      const missing = DOC_KEYS.filter((key) => !files[key]?.[0]);
      if (missing.length) {
        return res.status(400).json({ error: `Please upload PDF/JPG/PNG files (under 5MB) for: ${missing.join(', ')}.` });
      }

      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' });
      const documents = {};
      for (const key of DOC_KEYS) {
        const file = files[key][0];
        const fileId = new mongoose.Types.ObjectId();
        await new Promise((resolve, reject) => {
          // The driver's GridFS API stores `contentType` under `metadata` now,
          // not as a top-level field — see the matching read in employees.js.
          const uploadStream = bucket.openUploadStreamWithId(fileId, file.originalname, {
            metadata: { contentType: file.mimetype },
          });
          uploadStream.on('error', reject);
          uploadStream.on('finish', resolve);
          uploadStream.end(file.buffer);
        });
        documents[key] = fileId.toString();
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await User.updateOne(
        { _id: employee.user_id },
        { $set: { password: passwordHash, is_verified: true } }
      );

      employee.documents = { ...(employee.documents || {}), ...documents };
      employee.invite_token_hash = undefined;
      employee.invite_expires_at = undefined;
      await employee.save();

      return res.json({ success: true });
    } catch (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'One of your files is too large (max 5MB each).' });
      }
      console.error('complete staff-setup error:', err);
      return res.status(500).json({ error: 'Could not complete your account setup.' });
    }
  }
);

module.exports = router;
