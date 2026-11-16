// Pure rules for the Super Admin ticket desk (no database), so they can be unit tested.
// Used by api/_lib/routes/admin-tickets.js.
import { OPEN_STATUSES, PRIORITIES, CATEGORIES, cleanStr } from './support.js'

export const DAY_MS = 86400000
// A ticket open longer than this is flagged red ("27d old") and counted in the "waiting" pill.
export const ATTENTION_AFTER_DAYS = 14
// Resolved card: null = all time; a number = only tickets resolved in the last N days.
export const RESOLVED_WINDOW_DAYS = null

// One list, edited in one place. `value` is what gets stored.
export const RESOLUTION_CODES = [
  { value: 'answered', label: 'Answered' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'no_action', label: 'No action needed' },
  { value: 'cannot_reproduce', label: 'Cannot reproduce' },
  { value: 'referred_to_branch', label: 'Referred to branch' },
]
export const RESOLUTION_CODE_VALUES = RESOLUTION_CODES.map((c) => c.value)

// Statuses an admin may pick in a dropdown. `resolved` is deliberately absent: only Resolve ticket gets there.
export const WORKFLOW_STATUSES = ['open', 'in_progress', 'waiting_on_user']
export const DONE_STATUSES = ['resolved', 'closed']
export const SORTS = ['oldest', 'newest', 'priority', 'updated']
export const TICKET_ROLES = ['owner', 'therapist', 'guardian']

export class TicketError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}

export const isDone = (t) => DONE_STATUSES.includes(t.status)
export const versionOf = (t) => new Date(t.ticket_updated_at || t.ticket_created_at || 0).getTime()

// ── Summary cards (always over every ticket, never the filters) ──────────────
export function computeStats(tickets, now = Date.now(), { attentionDays = ATTENTION_AFTER_DAYS, resolvedWindowDays = RESOLVED_WINDOW_DAYS } = {}) {
  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status))
  const ages = open.map((t) => Math.max(0, now - new Date(t.ticket_created_at).getTime()))
  const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').filter((t) => (
    resolvedWindowDays == null || (t.resolved_at && now - new Date(t.resolved_at).getTime() <= resolvedWindowDays * DAY_MS)
  ))
  return {
    openCount: open.length,
    oldestOpenMs: ages.length ? Math.max(...ages) : null,
    resolvedCount: resolved.length,
    averageAgeMs: ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null,
    waitingPastThreshold: ages.filter((a) => a > attentionDays * DAY_MS).length,
    attentionDays,
  }
}

// ── Filters, tabs, sort ──────────────────────────────────────────────────────
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const clean = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max)
const oneOf = (v, list) => (typeof v === 'string' && list.includes(v) ? v : null)

// Query string -> Mongo match. `tab` is kept apart so tab counts can ignore it.
export function parseListQuery(q = {}) {
  const status = oneOf(q.status, [...WORKFLOW_STATUSES, 'resolved', 'closed'])
  const match = {}
  if (status) match.status = status
  const category = oneOf(q.category, CATEGORIES); if (category) match.category = category
  const priority = oneOf(q.priority, PRIORITIES); if (priority) match.priority = priority
  const role = oneOf(q.role, TICKET_ROLES); if (role) match.requester_role = role
  const needle = clean(q.q, 80)
  if (needle) match.$or = [{ subject: { $regex: escRe(needle), $options: 'i' } }, { ticket_no: { $regex: escRe(needle), $options: 'i' } }]
  const tab = oneOf(q.tab, ['owner_request', 'concern'])
  const sort = oneOf(q.sort, SORTS) || 'oldest'
  const skip = Math.max(0, Math.min(100000, parseInt(q.cursor, 10) || 0))
  return { match, tab, sort, skip }
}

export function sortStage(sort) {
  if (sort === 'newest') return { ticket_created_at: -1 }
  if (sort === 'updated') return { ticket_updated_at: -1 }
  if (sort === 'priority') return { priority_rank: 1, ticket_created_at: 1 }
  return { ticket_created_at: 1 }
}
export const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 }

// In-memory twin of the pipeline above (used by unit tests and by anything that already holds rows).
export function filterAndSort(rows, query) {
  const { match, tab, sort } = parseListQuery(query)
  const needle = clean(query.q, 80).toLowerCase()
  const out = rows.filter((t) => (
    (!match.status || t.status === match.status) && (!match.category || t.category === match.category) &&
    (!match.priority || t.priority === match.priority) && (!match.requester_role || t.requester_role === match.requester_role) &&
    (!tab || t.type === tab) && (!needle || String(t.subject).toLowerCase().includes(needle) || String(t.ticket_no).toLowerCase().includes(needle))
  ))
  const ts = (d) => new Date(d).getTime()
  const by = {
    oldest: (a, b) => ts(a.ticket_created_at) - ts(b.ticket_created_at),
    newest: (a, b) => ts(b.ticket_created_at) - ts(a.ticket_created_at),
    updated: (a, b) => ts(b.ticket_updated_at) - ts(a.ticket_updated_at),
    priority: (a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || ts(a.ticket_created_at) - ts(b.ticket_created_at),
  }[sort]
  return [...out].sort(by)
}

// Tab counts honour search + dropdown filters but not the tab itself.
export function tabCounts(rows, query) {
  const base = filterAndSort(rows, { ...query, tab: undefined })
  return { all: base.length, owner_request: base.filter((t) => t.type === 'owner_request').length, concern: base.filter((t) => t.type === 'concern').length }
}

// ── Guards ───────────────────────────────────────────────────────────────────
export function assertWritable(ticket) {
  if (isDone(ticket)) throw new TicketError(409, 'TICKET_RESOLVED_READ_ONLY', 'This ticket is resolved. Reopen it to make changes.')
}

export function assertVersion(ticket, version) {
  if (typeof version !== 'number' || !Number.isFinite(version) || version !== versionOf(ticket)) {
    throw new TicketError(409, 'VERSION_CONFLICT', 'This ticket was updated by someone else. Reload to see it.')
  }
}

// Status can move between the workflow statuses only. Resolved is reachable through Resolve ticket alone.
export function assertStatusChange(ticket, next) {
  assertWritable(ticket)
  if (!WORKFLOW_STATUSES.includes(next)) {
    throw new TicketError(400, 'INVALID_STATUS_TRANSITION', next === 'resolved' || next === 'closed'
      ? 'Use Resolve ticket to complete a ticket. The status menu never resolves it.'
      : 'That status is not allowed.')
  }
}

export function validateResolution({ resolutionCode, resolutionNotes }, ticket) {
  if (ticket && isDone(ticket)) throw new TicketError(409, 'ALREADY_RESOLVED', 'This ticket is already resolved.')
  const code = typeof resolutionCode === 'string' ? resolutionCode.trim() : ''
  if (!code) throw new TicketError(400, 'RESOLUTION_CODE_REQUIRED', 'Choose a resolution code.')
  if (!RESOLUTION_CODE_VALUES.includes(code)) throw new TicketError(400, 'INVALID_RESOLUTION_CODE', 'That resolution code is not valid.')
  const notes = cleanStr(typeof resolutionNotes === 'string' ? resolutionNotes.replace(/\r\n/g, '\n') : '', 5000)
  if (!notes) throw new TicketError(400, 'RESOLUTION_NOTES_REQUIRED', 'Add resolution notes. The requester will see them.')
  return { code, notes }
}

// What a requester may ever see: public messages only, nothing internal.
export const requesterVisibleMessages = (messages) => messages.filter((m) => !m.is_internal)

export function requireSuperAdmin(user) {
  if (!user || user.role !== 'Super Admin') throw new TicketError(403, 'NOT_ALLOWED', 'You do not have access to this.')
}
