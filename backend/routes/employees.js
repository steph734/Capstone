const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Branch = require('../models/Branch');
const { sendApplicationReceivedEmail, sendHiredEmail, sendRejectedEmail, sendIdCardEmail } = require('../utils/employeeEmails');
const { INVITE_TTL_MS, generateInviteToken, hashInviteToken } = require('../utils/staffInvite');

const router = express.Router();

const DOC_KEYS = ['ptr', 'prc', 'diploma', 'id'];
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => cb(null, file.fieldname === 'photo' ? PHOTO_MIME.has(file.mimetype) : ALLOWED_MIME.has(file.mimetype)),
});
const uploadDocFields = upload.fields([
  ...DOC_KEYS.map((key) => ({ name: key, maxCount: 1 })),
  { name: 'photo', maxCount: 1 },
]);

// Separate multer instance for the "email ID card" route below — a single
// generated PDF, not one of the onboarding document fields above.
const uploadIdCardPdfField = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
}).single('pdf');

function uploadIdCardPdf(req, res, next) {
  uploadIdCardPdfField(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'The ID card file is too large (max 5MB).'
        : 'Please attach a valid PDF file.';
      return res.status(400).json({ error: message });
    }
    next();
  });
}

// multer's own errors (e.g. a file over the 5MB limit) surface through this
// middleware's callback, not a thrown exception — they never reach the route
// handler's try/catch below, so without this they'd fall through to
// Express's default handler as a bare, unhelpful 500.
function uploadDocs(req, res, next) {
  uploadDocFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'One of your files is too large (max 5MB each).'
        : `Upload error: ${err.message}`;
      return res.status(400).json({ error: message });
    }
    if (err) return res.status(400).json({ error: 'Could not process the uploaded files.' });
    next();
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDER_MAP = { Male: 'male', Female: 'female', 'Prefer not to say': 'prefer_not_to_say' };
// Atlas's `employees` collection validator requires these exact capitalized
// values for `employment_type` — must match, not the lowercase-hyphenated
// style used for `status`/`gender` below.
const EMPLOYMENT_MAP = { 'Full-time': 'Full-time', 'Part-time': 'Part-time', Contract: 'Contract', Locum: 'Locum' };

// "Jade Ann Dela Cruz Tan" -> { first_name: 'Jade', middle_name: 'Ann Dela Cruz', last_name: 'Tan' }
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', middle_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], middle_name: '', last_name: '' };
  if (parts.length === 2) return { first_name: parts[0], middle_name: '', last_name: parts[1] };
  return { first_name: parts[0], middle_name: parts.slice(1, -1).join(' '), last_name: parts[parts.length - 1] };
}

async function uniqueUsername(base) {
  const clean = (base || 'staff').replace(/[^a-z0-9._-]/gi, '') || 'staff';
  let candidate = clean;
  let n = 1;
  while (await User.exists({ username: candidate })) candidate = `${clean}${n++}`;
  return candidate;
}

// GET /api/employees -> newest first, with branch name + account status populated
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find()
      .sort({ created_at: -1 })
      .populate('branch_id', 'branch_name')
      .populate('user_id', 'is_verified')
      .lean();
    res.json({ employees });
  } catch (err) {
    console.error('list employees error:', err);
    res.status(500).json({ error: 'Could not load employees.' });
  }
});

// POST /api/employees/send-id-card — emails a copy of a staff member's ID
// card (rendered client-side, since the card layout lives in canvas code on
// the owner dashboard) as a PDF attachment. Not tied to a specific employee
// id so it also works for demo/local-only staff rows that have no Mongo doc.
router.post('/send-id-card', uploadIdCardPdf, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid staff email is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No ID card PDF was attached.' });
    }
    await sendIdCardEmail({
      email,
      name,
      pdfBase64: req.file.buffer.toString('base64'),
      fileName: `${(name || 'staff').replace(/\s+/g, '_')}_ID_Card.pdf`,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('send id card email error:', err);
    return res.status(500).json({ error: err.message || 'Could not email the ID card.' });
  }
});

// POST /api/employees — creates a linked User account (role: Therapist,
// unverified) plus the Employee record. The owner uploads the hire's PTR,
// PRC license, diploma, and ID right here (no self-setup email/link) — the
// new hire shows up in "For Review" immediately, and the owner checks the
// documents and approves them there. Rolls the User back if the Employee
// insert fails, so a bad request never leaves an orphaned account behind.
router.post(
  '/',
  uploadDocs,
  async (req, res) => {
  try {
    const body = req.body || {};
    const fullName = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const branchId = String(body.branchId || '').trim();
    const position = String(body.position || body.specialty || '').trim();
    const hiredAt = body.hiredAt ? new Date(body.hiredAt) : null;
    const employeeId = String(body.employeeId || '').trim();

    if (!fullName || !email || !branchId || !position || !hiredAt || Number.isNaN(hiredAt.getTime()) || !employeeId) {
      return res.status(400).json({ error: 'Name, email, branch, position, hire date, and employee ID are required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!mongoose.isValidObjectId(branchId)) {
      return res.status(400).json({ error: 'Invalid branch.' });
    }

    const branch = await Branch.findById(branchId).lean();
    if (!branch) return res.status(400).json({ error: 'That branch no longer exists.' });

    const clash = await User.findOne({ email }).lean();
    if (clash) return res.status(409).json({ error: 'That email is already registered.' });

    let user;
    try {
      const username = await uniqueUsername(email.split('@')[0]);
      // Staff sign in later via an invite/reset flow — this hash is never handed out.
      // Hashed with SHA-256 before bcrypt, same as every password a browser
      // sends us (login/signup/reset all pre-hash client-side) — see the
      // matching comment at the real temp password below.
      const tempPassword = crypto.randomBytes(12).toString('base64url');
      const tempPasswordDigest = crypto.createHash('sha256').update(tempPassword).digest('hex');
      const password_hash = await bcrypt.hash(tempPasswordDigest, 10);
      user = await User.create({
        full_name: fullName,
        username,
        email,
        role: 'Therapist',
        password: password_hash,
        is_verified: false,
        status: 'Active',
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ error: 'That email or username is already registered.' });
      }
      throw err;
    }

    const { first_name, middle_name, last_name } = splitName(fullName);
    const doc = {
      user_id: user._id,
      branch_id: branch._id,
      first_name,
      middle_name,
      last_name,
      position,
      hired_at: hiredAt,
      email,
      // A brand-new hire isn't on duty yet — they sit in "for_review" until
      // the owner approves them (see PATCH /:id/approve below), so the duty
      // status the wizard collects (On Duty/On Leave) doesn't apply yet.
      status: 'for_review',
    };

    if (body.phoneCode && body.phone) {
      doc.phone = { country_code: String(body.phoneCode), number: String(body.phone) };
    }
    if (body.dob) {
      const d = new Date(body.dob);
      if (!Number.isNaN(d.getTime())) doc.dob = d;
    }
    if (body.gender) doc.gender = GENDER_MAP[body.gender] || String(body.gender).toLowerCase();
    if (body.address) doc.address = String(body.address).trim();
    if (body.emergencyContact) doc.emergency_contact = String(body.emergencyContact).trim();
    if (body.emergencyCode && body.emergencyPhone) {
      doc.emergency_phone = `${body.emergencyCode} ${body.emergencyPhone}`;
    }
    if (body.specialty) doc.specialty = String(body.specialty).trim();
    doc.employee_id = employeeId;
    if (body.prcNumber) doc.prc_number = String(body.prcNumber).trim();
    if (body.experience !== undefined && body.experience !== '') {
      const n = Number(body.experience);
      if (!Number.isNaN(n)) doc.experience = n;
    }
    if (body.employment) doc.employment_type = EMPLOYMENT_MAP[body.employment] || String(body.employment).toLowerCase();
    if (body.licenseExpiry) {
      const d = new Date(body.licenseExpiry);
      if (!Number.isNaN(d.getTime())) doc.license_expiry = d;
    }

    // The owner uploads the 4 required documents right here in the wizard —
    // multer's fileFilter silently drops any file with a disallowed
    // mimetype, so a bad-type upload shows up the same way a missing one does.
    const files = req.files || {};
    const missing = DOC_KEYS.filter((key) => !files[key]?.[0]);
    if (missing.length) {
      return res.status(400).json({ error: `Please upload PDF/JPG/PNG files (under 5MB) for: ${missing.join(', ')}.` });
    }

    let employee;
    try {
      employee = await Employee.create(doc);
    } catch (err) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
      throw err;
    }

    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' });
      const documents = {};
      for (const key of DOC_KEYS) {
        const file = files[key][0];
        const fileId = new mongoose.Types.ObjectId();
        await new Promise((resolve, reject) => {
          // The driver's GridFS API stores `contentType` under `metadata`,
          // not as a top-level field — see the matching read below.
          const uploadStream = bucket.openUploadStreamWithId(fileId, file.originalname, {
            metadata: { contentType: file.mimetype },
          });
          uploadStream.on('error', reject);
          uploadStream.on('finish', resolve);
          uploadStream.end(file.buffer);
        });
        documents[key] = fileId.toString();
      }
      employee.documents = documents;

      // Optional — the owner may skip it, unlike the 4 required documents above.
      const photoFile = files.photo?.[0];
      if (photoFile) {
        const photoFileId = new mongoose.Types.ObjectId();
        await new Promise((resolve, reject) => {
          const uploadStream = bucket.openUploadStreamWithId(photoFileId, photoFile.originalname, {
            metadata: { contentType: photoFile.mimetype },
          });
          uploadStream.on('error', reject);
          uploadStream.on('finish', resolve);
          uploadStream.end(photoFile.buffer);
        });
        employee.profile_picture = {
          storage_key: photoFileId.toString(),
          url: `/api/employees/${employee._id}/photo`,
          uploaded_at: new Date(),
        };
      }

      await employee.save();
    } catch (err) {
      await Employee.deleteOne({ _id: employee._id }).catch(() => {});
      await User.deleteOne({ _id: user._id }).catch(() => {});
      console.error('upload employee documents error:', err);
      return res.status(500).json({ error: 'Could not save the uploaded documents. Please try again.' });
    }

    // Documents already came from the owner, so there's nothing left for the
    // hire to "verify" — this just satisfies the same is_verified check the
    // approve route uses, matching what self-setup used to signal.
    await User.updateOne({ _id: user._id }, { $set: { is_verified: true } });
    user.is_verified = true;

    // Best-effort — the employee record is already saved, so a flaky email
    // provider shouldn't turn a successful hire into a failed request.
    try {
      await sendApplicationReceivedEmail({ email, name: fullName });
    } catch (err) {
      console.error('send application received email error:', err);
    }

    return res.status(201).json({ success: true, employee, user: user.toSafeJSON() });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'One of your files is too large (max 5MB each).' });
    }
    console.error('create employee error:', err);
    return res.status(500).json({ error: 'Could not save the employee record.' });
  }
});

// PATCH /api/employees/:id/approve -> owner signs off on a hire's uploaded
// documents, moving them out of "For Review" and into the Employees list.
router.patch('/:id/approve', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' });
  }
  try {
    const employee = await Employee.findById(id).populate('user_id', 'is_verified email full_name');
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });
    if (!employee.user_id?.is_verified) {
      return res.status(400).json({ error: 'This hire has not finished uploading their documents yet.' });
    }

    // Generate the real login password only now — the placeholder hash set
    // at creation was never meant to be handed out (see POST '/' above).
    // Only this plaintext copy exists, and only for this one response.
    // Bcrypt-hash its SHA-256 digest, not the raw string — every password a
    // browser ever sends us (login, signup, reset, and the "set password"
    // link this gets emailed with) is pre-hashed with SHA-256 client-side
    // before it hits bcrypt, so this stored hash must follow the same shape
    // or the employee's first real login (and the "must differ from the
    // temp password" check in setPassword.js) would never match.
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const tempPasswordDigest = crypto.createHash('sha256').update(tempPassword).digest('hex');
    const password_hash = await bcrypt.hash(tempPasswordDigest, 10);
    // Login stays blocked (see auth.js) until they use this emailed, single-use
    // link to replace the temp password with one only they know.
    const setupToken = generateInviteToken();
    const setupTokenHash = hashInviteToken(setupToken);
    await User.updateOne(
      { _id: employee.user_id._id },
      {
        $set: {
          password: password_hash,
          password_change_at: null,
          must_set_password: true,
          password_setup_token_hash: setupTokenHash,
          password_setup_expires_at: new Date(Date.now() + INVITE_TTL_MS),
        },
      }
    );

    employee.approved_at = new Date();
    if (employee.status === 'for_review') employee.status = 'active';
    await employee.save();

    const name = employee.user_id.full_name || `${employee.first_name} ${employee.last_name}`.trim();
    try {
      await sendHiredEmail({ email: employee.user_id.email, name, tempPassword, setupToken });
    } catch (err) {
      console.error('send hired email error:', err);
    }

    return res.json({ success: true, employee, tempPassword });
  } catch (err) {
    console.error('approve employee error:', err);
    return res.status(500).json({ error: 'Could not approve this employee.' });
  }
});

// DELETE /api/employees/:id -> owner rejects a reviewed hire; since they were
// never actually hired, this removes both the Employee record and its linked
// (still-unhired) User account.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' });
  }
  try {
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    const body = req.body || {};
    const reason = String(body.reason || '').trim();
    const note = String(body.note || '').trim();
    const name = `${employee.first_name} ${employee.last_name}`.trim();

    // Send the notice before deleting — once the records are gone there's
    // nothing left to read the applicant's email/name from.
    if (employee.email && reason) {
      try {
        await sendRejectedEmail({ email: employee.email, name, reason, note });
      } catch (err) {
        console.error('send rejected email error:', err);
      }
    }

    await Employee.deleteOne({ _id: id });
    await User.deleteOne({ _id: employee.user_id }).catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    console.error('reject employee error:', err);
    return res.status(500).json({ error: 'Could not reject this applicant.' });
  }
});

// GET /api/employees/:id/documents/:key/file -> streams an uploaded document
// (stored in GridFS by routes/staffSetup.js) back to the owner's dashboard.
router.get('/:id/documents/:key/file', async (req, res) => {
  const { id, key } = req.params;
  if (!['ptr', 'prc', 'diploma', 'id'].includes(key)) {
    return res.status(400).json({ error: 'Unknown document type.' });
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' });
  }

  try {
    const employee = await Employee.findById(id).lean();
    const fileId = employee?.documents?.[key];
    if (!fileId || !mongoose.isValidObjectId(fileId)) {
      return res.status(404).json({ error: 'No document uploaded for this field.' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' });
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    const file = files[0];
    if (!file) return res.status(404).json({ error: 'Document not found.' });

    res.set('Content-Type', file.metadata?.contentType || file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${(file.filename || key).replace(/"/g, '')}"`);
    bucket.openDownloadStream(file._id).on('error', () => res.status(404).end()).pipe(res);
  } catch (err) {
    console.error('stream employee document error:', err);
    res.status(500).json({ error: 'Could not load the document.' });
  }
});

// GET /api/employees/:id/photo -> streams the staff member's profile photo,
// same GridFS bucket/pattern as the documents route above.
router.get('/:id/photo', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' });
  }

  try {
    const employee = await Employee.findById(id).lean();
    const fileId = employee?.profile_picture?.storage_key;
    if (!fileId || !mongoose.isValidObjectId(fileId)) {
      return res.status(404).json({ error: 'No photo uploaded for this employee.' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' });
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    const file = files[0];
    if (!file) return res.status(404).json({ error: 'Photo not found.' });

    res.set('Content-Type', file.metadata?.contentType || file.contentType || 'application/octet-stream');
    bucket.openDownloadStream(file._id).on('error', () => res.status(404).end()).pipe(res);
  } catch (err) {
    console.error('stream employee photo error:', err);
    res.status(500).json({ error: 'Could not load the photo.' });
  }
});

module.exports = router;
