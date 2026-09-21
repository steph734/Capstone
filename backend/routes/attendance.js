const express = require('express');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');

const router = express.Router();

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initialsFromName(name) {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  );
}

// POST /api/attendance/scan -> logs a Time In/Time Out for the employee whose
// badge barcode was just decoded by the owner's webcam scanner. The scanned
// value is the human-readable `employee_id` string on the Employee doc (e.g.
// "T-247550"), not a Mongo _id — the Attendance record stores the real
// employees._id reference once the employee is resolved.
router.post('/scan', async (req, res) => {
  const code = String(req.body?.employee_id || '').trim();
  if (!code) {
    return res.status(400).json({ error: 'No badge code was provided.' });
  }

  try {
    const employee = await Employee.findOne({ employee_id: code }).populate('branch_id', 'branch_name');
    if (!employee) {
      return res.status(404).json({ error: `No staff member matches badge "${code}".` });
    }

    const date = todayStamp();
    const now = new Date();
    let record = await Attendance.findOne({ employee: employee._id, date });
    let type;

    if (!record) {
      record = await Attendance.create({ employee: employee._id, date, time_in: now });
      type = 'Time In';
    } else if (!record.time_out) {
      record.time_out = now;
      await record.save();
      type = 'Time Out';
    } else {
      // Already completed a full in/out cycle today — a further scan starts
      // a fresh one rather than silently overwriting the finished record.
      record.time_in = now;
      record.time_out = undefined;
      await record.save();
      type = 'Time In';
    }

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ');
    return res.json({
      name,
      initials: initialsFromName(name),
      specialty: employee.specialty || employee.position || '',
      branch: employee.branch_id?.branch_name || '',
      type,
      loggedAt: type === 'Time In' ? record.time_in : record.time_out,
    });
  } catch (err) {
    console.error('attendance scan error:', err);
    return res.status(500).json({ error: 'Could not log attendance. Please try again.' });
  }
});

module.exports = router;
