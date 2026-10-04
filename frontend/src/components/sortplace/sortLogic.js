// Pure sorting rules for any sort_place game. No React here, so these are
// unit-tested on their own (see sortLogic.test.mjs).
//
// zones:    [{ zone_key, label, color }] — array order is the sorting order.
// sequence: 'zone_by_zone' — finish zone 1 before zone 2.
//           'any_order'    — sort freely (the default when missing).
// items:    [{ id, label, image_url, zone_key }] for one level.
// placed:   Set of item ids already sorted into their zone.

export function resolveSequence(sequence) {
  return sequence === 'zone_by_zone' ? 'zone_by_zone' : 'any_order'
}

// The zone the child must fill right now. With zone_by_zone it is the first
// zone (in array order) that still has unsorted items; with any_order there
// is no single active zone, so this returns null.
export function activeZoneKey(items, placed, zones, sequence) {
  if (resolveSequence(sequence) !== 'zone_by_zone') return null
  for (const z of zones) {
    if (items.some((it) => it.zone_key === z.zone_key && !placed.has(it.id))) return z.zone_key
  }
  return null
}

export function stepIndexOf(zones, activeKey) {
  if (activeKey == null) return -1
  return zones.findIndex((z) => z.zone_key === activeKey)
}

// Tapping a piece in the tray. Returns what should happen:
//   { status: 'selected' }      — lift it, ready for a zone tap
//   { status: 'placed' }        — already sorted, nothing to do
//   { status: 'wrong_step' }    — zone_by_zone: it belongs to a later zone
export function tapPiece(items, placed, zones, sequence, itemId) {
  const item = items.find((it) => it.id === itemId)
  if (!item) return { status: 'missing' }
  if (placed.has(item.id)) return { status: 'placed' }
  const active = activeZoneKey(items, placed, zones, sequence)
  if (active != null && item.zone_key !== active) return { status: 'wrong_step' }
  return { status: 'selected' }
}

// Tapping a zone with a piece selected (or not). Returns:
//   { status: 'no_selection' }  — nothing picked yet
//   { status: 'placed', itemId } — correct: sort it into this zone
//   { status: 'wrong_zone' }    — the piece belongs in another zone
//   { status: 'wrong_step' }    — zone_by_zone: this zone isn't the active one
export function tapZone(items, placed, zones, sequence, selectedId, zoneKey) {
  if (selectedId == null) return { status: 'no_selection' }
  const item = items.find((it) => it.id === selectedId)
  if (!item || placed.has(item.id)) return { status: 'no_selection' }
  const active = activeZoneKey(items, placed, zones, sequence)
  if (active != null && zoneKey !== active) return { status: 'wrong_step' }
  if (item.zone_key !== zoneKey) return { status: 'wrong_zone' }
  return { status: 'placed', itemId: item.id }
}

export function remainingCount(items, placed) {
  return items.filter((it) => !placed.has(it.id)).length
}

export function isLevelComplete(items, placed) {
  return items.length > 0 && remainingCount(items, placed) === 0
}

// The zone a wrong piece belongs in — used to glow the right zone after
// repeated misses (prompt_level full_model).
export function correctZoneFor(items, itemId) {
  return items.find((it) => it.id === itemId)?.zone_key ?? null
}

// Stable ids for items in a level (the seed data has no ids of its own).
export function withItemIds(levelItems, levelOrder) {
  return (levelItems || []).map((it, i) => ({ ...it, id: `${levelOrder}-${i}-${it.zone_key}-${it.label}` }))
}

export function isCoinItem(item) {
  return /\/coin-/.test(item?.image_url || '')
}
