// Run with:  npx vitest run api/_lib/ticketRules.test.js
import { describe, expect, it } from 'vitest'
import {
  ATTENTION_AFTER_DAYS, DAY_MS, TicketError, assertStatusChange, assertVersion, assertWritable, computeStats, filterAndSort, requesterVisibleMessages,
  requireSuperAdmin, tabCounts, validateResolution, versionOf,
} from './ticketRules.js'

const NOW = new Date('2026-11-16T00:00:00Z').getTime()
const daysAgo = (d) => new Date(NOW - d * DAY_MS)
const mk = (o) => ({ status: 'open', priority: 'normal', category: 'question', type: 'concern', requester_role: 'guardian', subject: 'Hi', ticket_no: 'TCK-1', ticket_created_at: daysAgo(1), ticket_updated_at: daysAgo(1), ...o })
const code = (fn) => { try { fn(); return null } catch (e) { return e instanceof TicketError ? e.code : 'OTHER' } }

describe('summary stats', () => {
  const rows = [mk({ ticket_created_at: daysAgo(27) }), mk({ ticket_created_at: daysAgo(32), type: 'owner_request' }), mk({ status: 'resolved', ticket_created_at: daysAgo(50), resolved_at: daysAgo(40) })]
  it('counts open, oldest, resolved, average age and waiting tickets', () => {
    const s = computeStats(rows, NOW)
    expect(s.openCount).toBe(2)
    expect(s.oldestOpenMs).toBe(32 * DAY_MS)
    expect(s.resolvedCount).toBe(1)
    expect(s.averageAgeMs / DAY_MS).toBeCloseTo(29.5, 5)
    expect(s.waitingPastThreshold).toBe(2)
  })
  it('handles no open tickets', () => {
    const s = computeStats([mk({ status: 'resolved' })], NOW)
    expect(s.openCount).toBe(0)
    expect(s.oldestOpenMs).toBeNull()
    expect(s.averageAgeMs).toBeNull()
  })
  it('can limit resolved to a window', () => {
    expect(computeStats(rows, NOW, { resolvedWindowDays: 30 }).resolvedCount).toBe(0)
    expect(computeStats(rows, NOW, { resolvedWindowDays: 60 }).resolvedCount).toBe(1)
  })
  it('uses the attention threshold', () => {
    expect(computeStats([mk({ ticket_created_at: daysAgo(ATTENTION_AFTER_DAYS - 1) })], NOW).waitingPastThreshold).toBe(0)
  })
})

describe('filters, tabs and sort', () => {
  const rows = [
    mk({ ticket_no: 'TCK-1000', subject: 'gfgfghh', requester_role: 'therapist', ticket_created_at: daysAgo(32), ticket_updated_at: daysAgo(2) }),
    mk({ ticket_no: 'TCK-1001', subject: 'Hi pogi', type: 'owner_request', requester_role: 'owner', priority: 'urgent', ticket_created_at: daysAgo(27), ticket_updated_at: daysAgo(1) }),
    mk({ ticket_no: 'TCK-1002', subject: 'Billing help', category: 'billing', priority: 'high', ticket_created_at: daysAgo(3), ticket_updated_at: daysAgo(3) }),
  ]
  const nos = (q) => filterAndSort(rows, q).map((t) => t.ticket_no)
  it('sorts oldest first by default, and the other sorts', () => {
    expect(nos({})).toEqual(['TCK-1000', 'TCK-1001', 'TCK-1002'])
    expect(nos({ sort: 'newest' })).toEqual(['TCK-1002', 'TCK-1001', 'TCK-1000'])
    expect(nos({ sort: 'priority' })).toEqual(['TCK-1001', 'TCK-1002', 'TCK-1000'])
    expect(nos({ sort: 'updated' })).toEqual(['TCK-1001', 'TCK-1000', 'TCK-1002'])
  })
  it('searches subject and number, case-insensitively', () => {
    expect(nos({ q: 'POGI' })).toEqual(['TCK-1001'])
    expect(nos({ q: 'tck-1002' })).toEqual(['TCK-1002'])
  })
  it('filters by tab, category, priority and role', () => {
    expect(nos({ tab: 'owner_request' })).toEqual(['TCK-1001'])
    expect(nos({ category: 'billing' })).toEqual(['TCK-1002'])
    expect(nos({ priority: 'urgent' })).toEqual(['TCK-1001'])
    expect(nos({ role: 'therapist' })).toEqual(['TCK-1000'])
  })
  it('ignores unknown values instead of failing', () => {
    expect(nos({ priority: 'nonsense', sort: 'nonsense' })).toHaveLength(3)
  })
  it('tab counts follow search and filters but not the tab', () => {
    expect(tabCounts(rows, { tab: 'concern' })).toEqual({ all: 3, owner_request: 1, concern: 2 })
    expect(tabCounts(rows, { q: 'hi' })).toEqual({ all: 1, owner_request: 1, concern: 0 })
  })
})

describe('resolve and status rules', () => {
  it('blocks resolving without a code or notes', () => {
    expect(code(() => validateResolution({ resolutionNotes: 'done' }, mk({})))).toBe('RESOLUTION_CODE_REQUIRED')
    expect(code(() => validateResolution({ resolutionCode: 'fixed', resolutionNotes: '   ' }, mk({})))).toBe('RESOLUTION_NOTES_REQUIRED')
    expect(code(() => validateResolution({ resolutionCode: 'bogus', resolutionNotes: 'x' }, mk({})))).toBe('INVALID_RESOLUTION_CODE')
    expect(code(() => validateResolution({ resolutionCode: 'fixed', resolutionNotes: 'x' }, mk({ status: 'resolved' })))).toBe('ALREADY_RESOLVED')
    expect(validateResolution({ resolutionCode: 'fixed', resolutionNotes: ' Fixed it\r\nthanks ' }, mk({}))).toEqual({ code: 'fixed', notes: 'Fixed it\nthanks' })
  })
  it('never lets the status dropdown set resolved or closed', () => {
    expect(code(() => assertStatusChange(mk({}), 'resolved'))).toBe('INVALID_STATUS_TRANSITION')
    expect(code(() => assertStatusChange(mk({}), 'closed'))).toBe('INVALID_STATUS_TRANSITION')
    expect(code(() => assertStatusChange(mk({}), 'in_progress'))).toBeNull()
  })
  it('keeps resolved tickets read-only', () => {
    expect(code(() => assertWritable(mk({ status: 'resolved' })))).toBe('TICKET_RESOLVED_READ_ONLY')
    expect(code(() => assertStatusChange(mk({ status: 'resolved' }), 'open'))).toBe('TICKET_RESOLVED_READ_ONLY')
  })
})

describe('versions and privacy', () => {
  it('detects a version conflict', () => {
    const t = mk({ ticket_updated_at: daysAgo(1) })
    expect(code(() => assertVersion(t, versionOf(t)))).toBeNull()
    expect(code(() => assertVersion(t, versionOf(t) - 1))).toBe('VERSION_CONFLICT')
    expect(code(() => assertVersion(t, undefined))).toBe('VERSION_CONFLICT')
  })
  it('never returns internal notes to a requester', () => {
    const out = requesterVisibleMessages([{ body: 'hi', is_internal: false }, { body: 'secret', is_internal: true }])
    expect(out.map((m) => m.body)).toEqual(['hi'])
  })
  it('gives non-admins NOT_ALLOWED', () => {
    expect(code(() => requireSuperAdmin({ role: 'Owner' }))).toBe('NOT_ALLOWED')
    expect(code(() => requireSuperAdmin({ role: 'Therapist' }))).toBe('NOT_ALLOWED')
    expect(code(() => requireSuperAdmin({ role: 'Super Admin' }))).toBeNull()
  })
})
