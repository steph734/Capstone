const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Branch = require('../models/Branch');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDER_MAP = { Male: 'male', Female: 'female', 'Prefer not to say': 'prefer_not_to_say' };
const EMPLOYMENT_MAP = { 'Full-time': 'full-time', 'Part-time': 'part-time', Contract: 'contract' };
const STATUS_MAP = { 'On Duty': 'active', 'On Leave': 'on_leave' };

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

// GET /api/employees -> newest first, with branch name populated
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find()
      .sort({ created_at: -1 })
      .populate('branch_id', 'branch_name')
      .lean();
    res.json({ employees });
  } catch (err) {
    console.error('list employees error:', err);
    res.status(500).json({ error: 'Could not load employees.' });
  }
});

// POST /api/employees — creates a linked User account (role: Therapist,
// unverified) plus the Employee record. Rolls the User back if the Employee
// insert fails, so a bad request never leaves an orphaned account behind.
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const fullName = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const branchId = String(body.branchId || '').trim();
    const position = String(body.position || body.specialty || '').trim();
    const hiredAt = body.hiredAt ? new Date(body.hiredAt) : null;

    if (!fullName || !email || !branchId || !position || !hiredAt || Number.isNaN(hiredAt.getTime())) {
      return res.status(400).json({ error: 'Name, email, branch, position, and hire date are required.' });
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
      const tempPassword = crypto.randomBytes(12).toString('base64url');
      const password_hash = await bcrypt.hash(tempPassword, 10);
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
      status: STATUS_MAP[body.status] || 'active',
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
    if (body.employeeId) doc.employee_id = String(body.employeeId).trim();
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
    if (body.documents && typeof body.documents === 'object') {
      const docs = {};
      for (const key of ['ptr', 'prc', 'diploma', 'id']) {
        if (body.documents[key]) docs[key] = String(body.documents[key]);
      }
      if (Object.keys(docs).length) doc.documents = docs;
    }

    let employee;
    try {
      employee = await Employee.create(doc);
    } catch (err) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
      throw err;
    }

    return res.status(201).json({ success: true, employee, user: user.toSafeJSON() });
  } catch (err) {
    console.error('create employee error:', err);
    return res.status(500).json({ error: 'Could not save the employee record.' });
  }
});

module.exports = router;
