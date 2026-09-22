const express = require('express');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const TherapistAvailability = require('../models/TherapistAvailability');

const router = express.Router();

// Calendar-day key, fixed to Philippine local time (the clinic's only
// timezone, which never observes DST) rather than whatever timezone the
// Node process itself happens to run in. That distinction matters once this
// backend is hosted somewhere other than a developer's own PHT machine —
// most cloud hosts default their containers to UTC, and without pinning the
// zone here, any scan between local midnight and 8 AM would get bucketed
// under the wrong calendar day (UTC would still say "yesterday"), splitting
// a single time-in/time-out pair across two days or misreading a fresh
// time-in as a same-day time-out. Used to bucket individual scan events into
// "days" for display, since the attendance collection itself stores one row
// per scan, not one row per day.
const CLINIC_TIMEZONE = 'Asia/Manila';
const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateKeyOf(d) {
  // en-CA formats as YYYY-MM-DD, the same key format used everywhere else here.
  return dayKeyFormatter.format(new Date(d));
}

function todayStamp() {
  return dateKeyOf(new Date());
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

// POST /api/attendance/scan -> logs a time-in/time-out scan EVENT for the
// employee whose badge barcode was just decoded by the owner's webcam
// scanner. The scanned value is the human-readable `employee_id` string on
// the Employee doc (e.g. "T-247550"), not a Mongo _id. Unlike the old
// one-row-per-day design, each scan inserts a brand-new Attendance document
// (matching the `attendance` collection's live schema in Atlas) — whether
// it's a time-in or a time-out is decided by looking at this employee's most
// recent scan today, not by mutating a shared row.
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

    const now = new Date();
    const todayKey = todayStamp();
    const lastScan = await Attendance.findOne({ employee: employee._id, is_archived: { $ne: true } })
      .sort({ scanned_at: -1 });

    // No scan yet today -> this one starts a fresh time-in. A scan today that
    // was itself a time-in -> this one closes it out. A scan today that was
    // already a time-out (a completed in/out pair) -> a further scan starts a
    // new cycle rather than silently reopening the finished one.
    const type = (!lastScan || dateKeyOf(lastScan.scanned_at) !== todayKey || lastScan.type === 'time_out')
      ? 'time_in'
      : 'time_out';

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ');
    await Attendance.create({
      employee: employee._id,
      employee_name: name,
      branch_id: employee.branch_id?._id || null,
      branch_name: employee.branch_id?.branch_name || null,
      scanned_at: now,
      attendance_date: todayKey,
      timezone: CLINIC_TIMEZONE,
      type,
      source: 'webcam',
    });

    return res.json({
      name,
      initials: initialsFromName(name),
      specialty: employee.specialty || employee.position || '',
      branch: employee.branch_id?.branch_name || '',
      type: type === 'time_in' ? 'Time In' : 'Time Out',
      loggedAt: now,
    });
  } catch (err) {
    console.error('attendance scan error:', err);
    return res.status(500).json({ error: 'Could not log attendance. Please try again.' });
  }
});

// GET /api/attendance/me?email=... -> a therapist's own attendance log +
// this-month summary, for the "My Attendance" tab on their dashboard.
// Scoped by email (there's no session/JWT in this app yet) — same lookup
// key the Employee doc itself uses. Buckets the raw scan events into one row
// per calendar day (earliest time-in, latest time-out) for display.
router.get('/me', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' });
  }

  try {
    const employee = await Employee.findOne({ email }).populate('branch_id', 'branch_name');
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' });
    }

    const events = await Attendance.find({ employee: employee._id, is_archived: { $ne: true } })
      .sort({ scanned_at: 1 })
      .limit(1000)
      .lean();

    const byDay = new Map();
    for (const ev of events) {
      const key = dateKeyOf(ev.scanned_at);
      if (!byDay.has(key)) byDay.set(key, { date: key, timeIn: null, timeOut: null });
      const bucket = byDay.get(key);
      if (ev.type === 'time_in') {
        if (!bucket.timeIn) bucket.timeIn = ev.scanned_at;
      } else if (ev.type === 'time_out') {
        bucket.timeOut = ev.scanned_at;
      }
    }
    const dayRecords = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90);

    const monthPrefix = todayStamp().slice(0, 7); // 'YYYY-MM'
    let daysThisMonth = 0;
    let hoursThisMonth = 0;
    for (const r of dayRecords) {
      if (!r.date.startsWith(monthPrefix)) continue;
      daysThisMonth += 1;
      if (r.timeIn && r.timeOut) {
        hoursThisMonth += (new Date(r.timeOut) - new Date(r.timeIn)) / 3600000;
      }
    }

    const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ');
    return res.json({
      employee: {
        name,
        specialty: employee.specialty || employee.position || '',
        branch: employee.branch_id?.branch_name || '',
      },
      summary: {
        daysThisMonth,
        hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
      },
      records: dayRecords,
    });
  } catch (err) {
    console.error('get my attendance error:', err);
    return res.status(500).json({ error: 'Could not load your attendance.' });
  }
});

// GET /api/attendance/availability?email=...&date=YYYY-MM-DD -> the same-day
// slots this therapist already answered for (confirmed or explicitly
// skipped), or `slots: null` if they haven't been asked yet today — that
// null vs. [] distinction is what the "you're clocked in" modal uses to
// decide whether it needs to show itself again.
router.get('/availability', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const date = String(req.query.date || '').trim() || todayStamp();
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' });
  }

  try {
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' });
    }

    const record = await TherapistAvailability.findOne({ employee: employee._id, date }).lean();
    return res.json({ date, slots: record ? record.slots : null });
  } catch (err) {
    console.error('get availability error:', err);
    return res.status(500).json({ error: 'Could not load availability.' });
  }
});

// POST /api/attendance/availability -> upserts the slots a therapist picked
// (or an empty array, if they hit "Skip for now") for the given day.
router.post('/availability', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const date = String(req.body?.date || '').trim() || todayStamp();
  const slots = Array.isArray(req.body?.slots) ? req.body.slots.filter((s) => typeof s === 'string') : [];
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' });
  }

  try {
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' });
    }

    await TherapistAvailability.findOneAndUpdate(
      { employee: employee._id, date },
      { $set: { slots } },
      { upsert: true, new: true }
    );
    return res.json({ date, slots });
  } catch (err) {
    console.error('save availability error:', err);
    return res.status(500).json({ error: 'Could not save availability.' });
  }
});

module.exports = router;
