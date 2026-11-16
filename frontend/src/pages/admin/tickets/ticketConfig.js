// Labels, canned messages and small formatters for the Super Admin ticket desk.
// The attention threshold and resolution codes come from the server (api/_lib/ticketRules.js); the
// values below are only fallbacks until the first response arrives.
export const DEFAULT_ATTENTION_DAYS = 14

export const STATUS_META = {
  open: { label: 'Open', icon: 'circle', tone: 'open' },
  in_progress: { label: 'In progress', icon: 'half', tone: 'progress' },
  waiting_on_user: { label: 'Waiting on requester', icon: 'pause', tone: 'waiting' },
  resolved: { label: 'Resolved', icon: 'check', tone: 'resolved' },
  closed: { label: 'Closed', icon: 'check', tone: 'resolved' },
}
export const WORKFLOW_STATUSES = ['open', 'in_progress', 'waiting_on_user']
export const PRIORITY_META = {
  urgent: { label: 'Urgent', icon: 'up2' },
  high: { label: 'High', icon: 'up' },
  normal: { label: 'Normal', icon: '' },
  low: { label: 'Low', icon: 'down' },
}
export const CATEGORY_LABEL = { bug: 'Bug / error', billing: 'Billing / payment', account: 'Account / login', question: 'Question', other: 'Other', game_request: 'Game request', branch: 'Branch' }
export const ROLE_LABEL = { owner: 'Owner', therapist: 'Therapist', guardian: 'Guardian', patient: 'Guardian', super_admin: 'Admin' }
export const TYPE_LABEL = { concern: 'Concern', owner_request: 'Owner request' }
export const SORT_LABEL = { oldest: 'Oldest first', newest: 'Newest first', priority: 'Highest priority', updated: 'Recently updated' }
export const FALLBACK_RESOLUTION_CODES = [
  { value: 'answered', label: 'Answered' }, { value: 'fixed', label: 'Fixed' }, { value: 'duplicate', label: 'Duplicate' },
  { value: 'no_action', label: 'No action needed' }, { value: 'cannot_reproduce', label: 'Cannot reproduce' }, { value: 'referred_to_branch', label: 'Referred to branch' },
]

// One editable place for canned text. {firstName} is filled in when inserted.
export const CANNED_REPLIES = [
  { id: 'looking', label: 'Thanks, looking into it', text: 'Thanks, {firstName}. We are looking into it and will update you soon.' },
  { id: 'details', label: 'Need more details', text: 'Hi {firstName}, could you share a few more details (what you were doing, and what you expected to happen)?' },
  { id: 'resolved', label: 'Issue resolved', text: 'Hi {firstName}, this issue has been resolved. Please let us know if you still see a problem.' },
]
export const CANNED_CLOSING = [
  { id: 'answered', label: 'Answered', text: 'We answered your question and confirmed the details with you. Nothing further is needed.' },
  { id: 'fixed', label: 'Fixed', text: 'We found the cause, applied a fix, and confirmed it is working for you. Please contact us if it comes back.' },
  { id: 'noaction', label: 'No action needed', text: 'We reviewed this request and no change is needed on our side.' },
]
export const fillCanned = (text, firstName) => text.split('{firstName}').join(firstName || 'there')

const DAY = 86400000
const HOUR = 3600000
// 27d; under a day, hours (5h); under an hour, 1h minimum.
export function formatAge(ms, { decimals = 0 } = {}) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < DAY) return `${Math.max(1, Math.floor(ms / HOUR))}h`
  const days = ms / DAY
  return `${decimals ? days.toFixed(decimals) : Math.floor(days)}d`
}
export const ageMs = (iso, now = Date.now()) => Math.max(0, now - new Date(iso).getTime())

export function relativeTime(iso, now = Date.now()) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  if (m < 1440) { const h = Math.floor(m / 60); return `${h} hour${h === 1 ? '' : 's'} ago` }
  const d = Math.floor(m / 1440)
  return `${d} day${d === 1 ? '' : 's'} ago`
}
export const fullDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
export const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || 'there'
export const displayName = (name) => name || 'Unknown'

export function isAttention(ticket, attentionDays = DEFAULT_ATTENTION_DAYS, now = Date.now()) {
  return ['open', 'in_progress', 'waiting_on_user'].includes(ticket.status) && ageMs(ticket.createdAt, now) > attentionDays * DAY
}
