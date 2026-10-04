// Run with: node --test src/components/sortplace/sortLogic.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeZoneKey, tapPiece, tapZone, isLevelComplete, remainingCount, withItemIds, isCoinItem,
} from './sortLogic.js'

const zones = [{ zone_key: 'wallet' }, { zone_key: 'purse' }]
const items = withItemIds([
  { label: '20 bill', zone_key: 'wallet', image_url: '/bill-20.png' },
  { label: '5 coin', zone_key: 'purse', image_url: '/coin-5.png' },
  { label: '50 bill', zone_key: 'wallet', image_url: '/bill-50.png' },
], 1)
const bill20 = items[0].id
const coin5 = items[1].id
const bill50 = items[2].id

test('zone_by_zone starts on the first zone with pieces left', () => {
  assert.equal(activeZoneKey(items, new Set(), zones, 'zone_by_zone'), 'wallet')
})

test('zone_by_zone moves to the purse once the bills are sorted', () => {
  const placed = new Set([bill20, bill50])
  assert.equal(activeZoneKey(items, placed, zones, 'zone_by_zone'), 'purse')
})

test('any_order has no single active zone', () => {
  assert.equal(activeZoneKey(items, new Set(), zones, 'any_order'), null)
  assert.equal(activeZoneKey(items, new Set(), zones, undefined), null)
})

test('zone_by_zone: a coin cannot be picked during the bills step', () => {
  assert.equal(tapPiece(items, new Set(), zones, 'zone_by_zone', coin5).status, 'wrong_step')
  assert.equal(tapPiece(items, new Set(), zones, 'zone_by_zone', bill20).status, 'selected')
})

test('zone_by_zone: tapping the purse during the bills step is refused', () => {
  const r = tapZone(items, new Set(), zones, 'zone_by_zone', bill20, 'purse')
  assert.equal(r.status, 'wrong_step')
})

test('zone tap with nothing selected', () => {
  assert.equal(tapZone(items, new Set(), zones, 'any_order', null, 'wallet').status, 'no_selection')
})

test('correct zone sorts the piece', () => {
  const r = tapZone(items, new Set(), zones, 'any_order', bill20, 'wallet')
  assert.deepEqual(r, { status: 'placed', itemId: bill20 })
})

test('any_order: a wrong zone is a gentle wrong_zone, never a placement', () => {
  assert.equal(tapZone(items, new Set(), zones, 'any_order', bill20, 'purse').status, 'wrong_zone')
})

test('a placed piece cannot be picked again', () => {
  assert.equal(tapPiece(items, new Set([bill20]), zones, 'any_order', bill20).status, 'placed')
})

test('level completes only when every piece is sorted', () => {
  assert.equal(isLevelComplete(items, new Set([bill20, bill50])), false)
  assert.equal(isLevelComplete(items, new Set([bill20, bill50, coin5])), true)
  assert.equal(remainingCount(items, new Set([bill20])), 2)
})

test('coins are recognised from their picture path', () => {
  assert.equal(isCoinItem(items[1]), true)
  assert.equal(isCoinItem(items[0]), false)
})
