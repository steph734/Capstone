const STORAGE_KEY = 'therapypro_audit_logs'
const MAX_LOGS = 200

// Seed history so the Audit Logs page isn't empty on first load — real
// actions recorded via logActivity() get prepended on top of these.
const SEED_LOGS = [
  { id: 1030, date: 'Jul 6, 2026', time: '09:12 AM', role: 'Owner', user: 'Owner', email: 'owner@therapypro.com', actionIcon: '💳', action: 'Subscription', description: 'Updated Gold plan pricing to ₱1,000/session', entity: 'Plan #Gold', status: 'Success' },
  { id: 1029, date: 'Jul 6, 2026', time: '08:45 AM', role: 'Owner', user: 'Owner', email: 'owner@therapypro.com', actionIcon: '🏢', action: 'Branch', description: 'Added North Branch to clinic locations', entity: 'Branch #North', status: 'Success' },
  { id: 1028, date: 'Jul 5, 2026', time: '04:20 PM', role: 'Therapist', user: 'Marco Reyes', email: 'marco.reyes@therapypro.com', actionIcon: '📝', action: 'Patient Notes', description: 'Updated clinical notes for Aira Lopez', entity: 'Patient #3', status: 'Review' },
  { id: 1027, date: 'Jul 5, 2026', time: '02:05 PM', role: 'Owner', user: 'Owner', email: 'owner@therapypro.com', actionIcon: '📤', action: 'Report', description: 'Exported monthly audit report (June 2026)', entity: 'Report #Jun26', status: 'Success' },
  { id: 1026, date: 'Jul 5, 2026', time: '10:30 AM', role: 'Therapist', user: 'Dr. Sarah Reyes', email: 'sarah.reyes@therapypro.com', actionIcon: '🎥', action: 'Video Call', description: 'Started video session with Alvrin', entity: 'Appointment #61', status: 'Success' },
  { id: 1025, date: 'Jul 4, 2026', time: '03:40 PM', role: 'Patient', user: 'Alvrin', email: 'alvrin@email.com', actionIcon: '📅', action: 'Appointment', description: 'Booked appointment with Dr. Sarah Reyes', entity: 'Appointment #60', status: 'Success' },
  { id: 1024, date: 'Jul 4, 2026', time: '11:15 AM', role: 'Patient', user: 'Aira Lopez', email: 'aira.lopez@email.com', actionIcon: '👤', action: 'Profile', description: 'Updated guardian contact information', entity: 'Patient #3', status: 'Success' },
  { id: 1023, date: 'Jul 3, 2026', time: '05:52 PM', role: 'Patient', user: 'Noah Cruz', email: 'noah.cruz@email.com', actionIcon: '❌', action: 'Appointment', description: 'Cancelled session scheduled for Jul 5', entity: 'Appointment #58', status: 'Review' },
  { id: 1022, date: 'Jul 3, 2026', time: '09:00 AM', role: 'Therapist', user: 'Andre Lim', email: 'andre.lim@therapypro.com', actionIcon: '🗃️', action: 'Staff', description: 'Archived own attendance record for review', entity: 'Staff #3', status: 'Success' },
  { id: 1021, date: 'Jul 2, 2026', time: '11:47 PM', role: 'System', user: 'Unknown', email: '—', actionIcon: '🔒', action: 'Login', description: 'Failed login attempt from unrecognized device', entity: 'Account #—', status: 'Failed' },
]

function readRaw() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore malformed storage
  }
  return null
}

export function getAuditLogs() {
  const stored = readRaw()
  return stored ?? SEED_LOGS
}

/**
 * Records a real user action to the audit log (newest first), persisted to
 * localStorage so it shows up on the Super Admin Audit Logs page.
 *
 * @param {Object} entry
 * @param {'Owner'|'Therapist'|'Patient'|'System'} entry.role
 * @param {string} entry.user - display name of the account performing the action
 * @param {string} entry.email
 * @param {string} entry.actionIcon - single emoji shown in the action badge
 * @param {string} entry.action - short action category, e.g. "Appointment"
 * @param {string} entry.description - one-sentence human-readable description
 * @param {string} entry.entity - the record affected, e.g. "Appointment #62"
 * @param {'Success'|'Review'|'Failed'} [entry.status]
 */
export function logActivity(entry) {
  const now = new Date()
  const existing = getAuditLogs()
  const nextId = (existing[0]?.id ?? 1000) + 1

  const record = {
    id: nextId,
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    status: 'Success',
    ...entry,
  }

  const updated = [record, ...existing].slice(0, MAX_LOGS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return record
}
