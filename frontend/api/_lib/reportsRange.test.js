// Run with:  npx vitest run api/_lib/reportsRange.test.js
import { describe, expect, it } from 'vitest'
import {
  parseRange, previousPeriod, resolveCompare, rangeBounds, zonedMidnight, pctChange, tone,
  granularityFor, bucketCount, bucketize, bucketLabels, addYears, daysInRange, clinicToday,
} from './reportsRange.js'
import { sanitizeCell, toCsv, exportFileName } from './reportsExport.js'

const NOW = new Date('2026-11-18T04:00:00Z') // 12:00 in Manila
const code = (fn) => { try { fn() } catch (e) { return e.code } return null }

describe('clinic timezone boundaries', () => {
  it('Oct 1 - Oct 31 is [Oct 1 00:00, Nov 1 00:00) in +08:00', () => {
    const { start, end } = rangeBounds('2026-10-01', '2026-10-31', 'Asia/Manila')
    expect(start.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-31T16:00:00.000Z')
  })
  it('includes the whole last day', () => {
    const { end } = rangeBounds('2026-10-01', '2026-10-31')
    expect(new Date('2026-10-31T15:59:59Z') < end).toBe(true)
    expect(new Date('2026-10-31T16:00:00Z') < end).toBe(false)
  })
  it('handles the leap day', () => {
    expect(zonedMidnight('2028-02-29', 'Asia/Manila').toISOString()).toBe('2028-02-28T16:00:00.000Z')
    expect(addYears('2028-02-29', -1)).toBe('2027-02-28')
  })
  it('today is the clinic date, not the UTC date', () => {
    expect(clinicToday(new Date('2026-11-17T17:00:00Z'))).toBe('2026-11-18')
  })
})

describe('parseRange', () => {
  it('accepts a normal range', () => {
    expect(parseRange('2026-10-01', '2026-10-31', { now: NOW })).toEqual({ from: '2026-10-01', to: '2026-10-31', clamped: false })
  })
  it('INVALID_DATE for malformed or impossible dates', () => {
    expect(code(() => parseRange('2026-13-01', '2026-10-31', { now: NOW }))).toBe('INVALID_DATE')
    expect(code(() => parseRange('2026-02-30', '2026-03-01', { now: NOW }))).toBe('INVALID_DATE')
    expect(code(() => parseRange(undefined, '2026-03-01', { now: NOW }))).toBe('INVALID_DATE')
    expect(code(() => parseRange('10/01/2026', '10/31/2026', { now: NOW }))).toBe('INVALID_DATE')
  })
  it('RANGE_REVERSED', () => {
    expect(code(() => parseRange('2026-10-31', '2026-10-01', { now: NOW }))).toBe('RANGE_REVERSED')
  })
  it('RANGE_IN_FUTURE when the start is in the future; clamps when only the end is', () => {
    expect(code(() => parseRange('2026-12-01', '2026-12-31', { now: NOW }))).toBe('RANGE_IN_FUTURE')
    expect(parseRange('2026-11-01', '2026-12-31', { now: NOW })).toEqual({ from: '2026-11-01', to: '2026-11-18', clamped: true })
  })
  it('RANGE_TOO_LARGE beyond 24 months, ok at exactly 24', () => {
    expect(code(() => parseRange('2024-01-01', '2026-11-18', { now: NOW }))).toBe('RANGE_TOO_LARGE')
    expect(parseRange('2024-11-19', '2026-11-18', { now: NOW }).clamped).toBe(false)
  })
})

describe('comparison range', () => {
  it('previous period is equal length and ends the day before', () => {
    expect(previousPeriod({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
    expect(previousPeriod({ from: '2026-09-01', to: '2026-09-30' })).toEqual({ from: '2026-08-02', to: '2026-08-31' })
    const p = previousPeriod({ from: '2026-11-01', to: '2026-11-18' })
    expect(daysInRange(p.from, p.to)).toBe(18)
  })
  it('previous year', () => {
    expect(resolveCompare({ from: '2026-10-01', to: '2026-10-31' }, 'previous_year', undefined, undefined, { now: NOW })).toEqual({ from: '2025-10-01', to: '2025-10-31' })
  })
  it('COMPARE_OVERLAPS for a custom range overlapping the selection', () => {
    expect(code(() => resolveCompare({ from: '2026-10-01', to: '2026-10-31' }, 'custom', '2026-10-15', '2026-11-05', { now: NOW }))).toBe('COMPARE_OVERLAPS')
    expect(resolveCompare({ from: '2026-10-01', to: '2026-10-31' }, 'custom', '2026-08-01', '2026-08-31', { now: NOW })).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })
})

describe('percent change and colour', () => {
  it('previous 0 -> null (never Infinity/NaN), rounds to 1 decimal', () => {
    expect(pctChange(100, 0)).toBeNull()
    expect(pctChange(0, 0)).toBeNull()
    expect(pctChange(468500, 442000)).toBe(6)
    expect(pctChange(1031, 1000)).toBe(3.1)
    expect(pctChange(50, 100)).toBe(-50)
  })
  it('goodDirection: Outstanding going up is bad, going down is good', () => {
    expect(tone(3.2, 'down')).toBe('bad')
    expect(tone(-3.2, 'down')).toBe('good')
    expect(tone(12.4, 'up')).toBe('good')
    expect(tone(-1, 'up')).toBe('bad')
    expect(tone(null, 'up')).toBe('neutral')
  })
})

describe('buckets', () => {
  it('daily up to 31 days, weekly up to ~6 months, monthly above', () => {
    expect(granularityFor('2026-10-01', '2026-10-31')).toBe('day')
    expect(granularityFor('2026-10-01', '2026-11-18')).toBe('week')
    expect(granularityFor('2026-01-01', '2026-11-18')).toBe('month')
  })
  it('current and comparison series have the same number of points', () => {
    const cur = { from: '2026-10-01', to: '2026-10-31' }
    const cmp = previousPeriod(cur)
    const g = granularityFor(cur.from, cur.to)
    const n = bucketCount(cur.from, cur.to, g)
    expect(bucketize([{ day: '2026-09-15', value: 5 }], cmp.from, g, n)).toHaveLength(n)
    expect(bucketLabels(cur.from, cur.to, g)).toHaveLength(n)
  })
  it('sums values into the right bucket', () => {
    const rows = [{ day: '2026-10-01', value: 1 }, { day: '2026-10-01', value: 2 }, { day: '2026-10-03', value: 4 }]
    expect(bucketize(rows, '2026-10-01', 'day', 31).slice(0, 4)).toEqual([3, 0, 4, 0])
  })
})

describe('exports', () => {
  it('prefixes formula-looking text cells', () => {
    for (const bad of ['=SUM(A1)', '+1', '-1', '@x']) expect(sanitizeCell(bad)).toBe(`'${bad}`)
    expect(sanitizeCell('Maria')).toBe('Maria')
  })
  it('CSV sanitises names, formats money; the file name carries the range', () => {
    const table = { title: 'T', cols: [{ key: 'n', label: 'Name', kind: 'text' }, { key: 'v', label: 'Amt', kind: 'money' }], rows: [{ n: '=cmd', v: 41190000 }] }
    const csv = toCsv([table]).toString()
    expect(csv).toContain("'=cmd")
    expect(csv).toContain('411900.00')
    expect(exportFileName('revenue', { from: '2026-10-01', to: '2026-10-31' }, 'csv')).toBe('revenue-report_2026-10-01_to_2026-10-31.csv')
  })
})
