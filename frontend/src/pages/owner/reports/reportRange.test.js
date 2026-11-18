// Run with:  npx vitest run src/pages/owner/reports/reportRange.test.js
import { describe, expect, it } from 'vitest'
import {
  presetRange, matchPreset, defaultRange, rangeFromParams, paramsForRange, apiQuery, pickDay, validateRange,
  parseTypedDay, monthGrid, moveFocus, compareFor, fmtRange, fmtRangeShort, describeDelta, createLatestGate, fmtMoney,
} from './reportRange'

const NOW = '2026-11-18'

describe('presets', () => {
  it('computes each quick range', () => {
    expect(presetRange('thisMonth', NOW)).toEqual({ from: '2026-11-01', to: NOW })
    expect(presetRange('lastMonth', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(presetRange('last7', NOW)).toEqual({ from: '2026-11-12', to: NOW })
    expect(presetRange('last30', NOW)).toEqual({ from: '2026-10-20', to: NOW })
    expect(presetRange('last3Months', NOW)).toEqual({ from: '2026-08-19', to: NOW })
    expect(presetRange('thisYear', NOW)).toEqual({ from: '2026-01-01', to: NOW })
    expect(presetRange('today', NOW)).toEqual({ from: NOW, to: NOW })
  })
  it('default range is the current month up to today', () => expect(defaultRange(NOW)).toEqual({ from: '2026-11-01', to: NOW }))
  it('matchPreset highlights the right quick range, custom otherwise', () => {
    expect(matchPreset({ from: '2026-10-01', to: '2026-10-31' }, NOW)).toBe('lastMonth')
    expect(matchPreset({ from: '2026-11-01', to: NOW }, NOW)).toBe('thisMonth')
    expect(matchPreset({ from: '2026-09-01', to: '2026-09-30' }, NOW)).toBe('custom')
  })
})

describe('URL query string', () => {
  it('round-trips a range (shareable, survives refresh)', () => {
    const qs = paramsForRange({ from: '2026-10-01', to: '2026-10-31' }).toString()
    expect(qs).toBe('from=2026-10-01&to=2026-10-31')
    expect(rangeFromParams(new URLSearchParams(qs), NOW).range).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('falls back to the default for missing or invalid values', () => {
    for (const qs of ['', 'from=2026-10-01', 'from=nope&to=2026-10-31', 'from=2026-10-31&to=2026-10-01', 'from=2026-12-01&to=2026-12-31']) {
      const r = rangeFromParams(new URLSearchParams(qs), NOW)
      expect(r.range).toEqual(defaultRange(NOW))
      expect(r.fromUrl).toBe(false)
    }
  })
  it('clamps an end date in the future', () => {
    expect(rangeFromParams(new URLSearchParams('from=2026-11-01&to=2026-12-31'), NOW).range).toEqual({ from: '2026-11-01', to: NOW })
  })
  it('keeps the comparison mode', () => {
    const qs = paramsForRange({ from: '2026-10-01', to: '2026-10-31' }, 'previous_year').toString()
    expect(rangeFromParams(new URLSearchParams(qs), NOW).compare).toBe('previous_year')
    expect(apiQuery({ from: '2026-10-01', to: '2026-10-31' }, 'custom', { from: '2026-08-01', to: '2026-08-31' })).toContain('compareFrom=2026-08-01')
  })
})

describe('picker behaviour', () => {
  it('first click sets start, second sets end, a third starts over', () => {
    let s = { start: null, end: null }
    s = pickDay(s, '2026-10-05', NOW); expect(s).toEqual({ start: '2026-10-05', end: null })
    s = pickDay(s, '2026-10-20', NOW); expect(s).toEqual({ start: '2026-10-05', end: '2026-10-20' })
    s = pickDay(s, '2026-10-01', NOW); expect(s).toEqual({ start: '2026-10-01', end: null })
  })
  it('swaps when the end is before the start', () => {
    expect(pickDay({ start: '2026-10-20', end: null }, '2026-10-05', NOW)).toEqual({ start: '2026-10-05', end: '2026-10-20' })
  })
  it('future days cannot be selected', () => {
    const s = { start: '2026-10-05', end: null }
    expect(pickDay(s, '2026-11-19', NOW)).toBe(s)
  })
  it('validates typed ranges (Apply stays disabled for these)', () => {
    expect(validateRange('2026-10-01', '2026-10-31', NOW)).toBe('')
    expect(validateRange('2026-10-31', '2026-10-01', NOW)).toMatch(/not be after/)
    expect(validateRange('2026-11-01', '2026-11-19', NOW)).toMatch(/Future/)
    expect(validateRange('2020-01-01', '2026-11-18', NOW)).toMatch(/24 months/)
    expect(validateRange('2026-02-30', '2026-03-01', NOW)).toMatch(/real dates/)
  })
  it('parses typed dates in several formats', () => {
    expect(parseTypedDay('Oct 1, 2026')).toBe('2026-10-01')
    expect(parseTypedDay('10/1/2026')).toBe('2026-10-01')
    expect(parseTypedDay('2026-10-01')).toBe('2026-10-01')
    expect(parseTypedDay('February 30, 2026')).toBeNull()
    expect(parseTypedDay('hello')).toBeNull()
  })
  it('builds the October 2026 calendar grid (starts on Thursday)', () => {
    const weeks = monthGrid('2026-10-15')
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0][4]).toBe('2026-10-01')
    expect(weeks.flat().filter(Boolean)).toHaveLength(31)
  })
  it('keyboard: arrows move by day/week, page keys by month, never past today', () => {
    expect(moveFocus('2026-10-10', 'ArrowRight', NOW)).toBe('2026-10-11')
    expect(moveFocus('2026-10-10', 'ArrowDown', NOW)).toBe('2026-10-17')
    expect(moveFocus('2026-10-10', 'ArrowUp', NOW)).toBe('2026-10-03')
    expect(moveFocus('2026-10-10', 'PageUp', NOW)).toBe('2026-09-10')
    expect(moveFocus('2026-11-15', 'PageDown', NOW)).toBe(NOW)
    expect(moveFocus('2026-11-18', 'ArrowDown', NOW)).toBe(NOW)
  })
})

describe('comparison and labels', () => {
  it('previous period has equal length; previous year shifts 12 months', () => {
    expect(compareFor({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
    expect(compareFor({ from: '2026-10-01', to: '2026-10-31' }, 'previous_year')).toEqual({ from: '2025-10-01', to: '2025-10-31' })
  })
  it('formats ranges', () => {
    expect(fmtRange('2026-09-01', '2026-09-30')).toBe('Sep 1 – Sep 30, 2026')
    expect(fmtRange('2025-12-15', '2026-01-10')).toBe('Dec 15, 2025 – Jan 10, 2026')
    expect(fmtRangeShort('2026-08-01', '2026-08-31')).toBe('Aug 1 – Aug 31')
    expect(fmtMoney(44200000)).toBe('₱442,000')
  })
  it('delta text carries a word for screen readers and the tone verdict (Outstanding up = decline)', () => {
    const d = describeDelta({ changePct: 3.2, deltaUnit: 'pct', tone: 'bad' }, 'vs Aug 1 – Aug 31')
    expect(d.direction).toBe('up')
    expect(d.sr).toMatch(/^Up 3\.2%/)
    expect(d.sr).toMatch(/decline/)
    expect(describeDelta({ changePct: null, tone: 'neutral' }, 'vs x').text).toBe('—')
    expect(describeDelta({ changePct: -1.5, deltaUnit: 'pts', tone: 'bad' }, 'vs x').text).toBe('1.5 pts')
  })
})

describe('stale responses', () => {
  it('only the newest request may update the page', () => {
    const gate = createLatestGate()
    const slowOldRange = gate.next()
    const newRange = gate.next()
    expect(gate.isLatest(slowOldRange)).toBe(false)
    expect(gate.isLatest(newRange)).toBe(true)
  })
})
