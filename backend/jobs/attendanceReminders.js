const cron = require('node-cron');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { sendTimeInReminderEmail, sendTimeOutReminderEmail } = require('../utils/employeeEmails');

// The clinic's official shift: 8:00 AM time in, 5:00 PM time out, Asia/Manila
// time (see CLINIC_TIMEZONE in routes/attendance.js). Reminders fire 5
// minutes ahead of each, Monday-Friday only.
const CLINIC_TIMEZONE = 'Asia/Manila';
const TIME_IN_REMINDER_CRON = '55 7 * * 1-5';  // 7:55 AM PH, Mon-Fri
const TIME_OUT_REMINDER_CRON = '55 16 * * 1-5'; // 4:55 PM PH, Mon-Fri

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function todayStamp() {
  return dayKeyFormatter.format(new Date());
}

function fullName(employee) {
  return [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ');
}

async function activeEmployeesWithEmail() {
  return Employee.find({ status: 'active', email: { $exists: true, $ne: '' } });
}

// 7:55 AM -> email anyone who hasn't scanned a time-in yet today.
async function runTimeInReminders() {
  const todayKey = todayStamp();
  const employees = await activeEmployeesWithEmail();

  const results = await Promise.allSettled(
    employees.map(async (employee) => {
      const timedInToday = await Attendance.exists({
        employee: employee._id,
        attendance_date: todayKey,
        type: 'time_in',
        is_archived: { $ne: true },
      });
      if (timedInToday) return;
      await sendTimeInReminderEmail({ email: employee.email, name: fullName(employee) });
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');
  console.log(`⏰ Time-in reminders: checked ${employees.length} staff, ${sent} processed, ${failed.length} failed.`);
  failed.forEach((r) => console.error('  time-in reminder error:', r.reason?.message || r.reason));
}

// 4:55 PM -> email anyone who timed in today but hasn't timed out yet.
async function runTimeOutReminders() {
  const todayKey = todayStamp();
  const employees = await activeEmployeesWithEmail();

  const results = await Promise.allSettled(
    employees.map(async (employee) => {
      const lastScanToday = await Attendance.findOne({
        employee: employee._id,
        attendance_date: todayKey,
        is_archived: { $ne: true },
      }).sort({ scanned_at: -1 });

      // No scan today, or already timed out -> nothing to remind about.
      if (!lastScanToday || lastScanToday.type !== 'time_in') return;
      await sendTimeOutReminderEmail({ email: employee.email, name: fullName(employee) });
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');
  console.log(`⏰ Time-out reminders: checked ${employees.length} staff, ${sent} processed, ${failed.length} failed.`);
  failed.forEach((r) => console.error('  time-out reminder error:', r.reason?.message || r.reason));
}

// Wires the two cron jobs into the running process. Call once, after the app
// has started (DB connection doesn't need to be ready yet — each run queries
// fresh, and a run that fires before Mongo connects just logs its own error).
function startAttendanceReminders() {
  cron.schedule(TIME_IN_REMINDER_CRON, () => {
    runTimeInReminders().catch((err) => console.error('time-in reminder job failed:', err));
  }, { timezone: CLINIC_TIMEZONE });

  cron.schedule(TIME_OUT_REMINDER_CRON, () => {
    runTimeOutReminders().catch((err) => console.error('time-out reminder job failed:', err));
  }, { timezone: CLINIC_TIMEZONE });

  console.log('⏰ Attendance reminder emails scheduled (7:55 AM & 4:55 PM PH, Mon-Fri).');
}

module.exports = { startAttendanceReminders, runTimeInReminders, runTimeOutReminders };
