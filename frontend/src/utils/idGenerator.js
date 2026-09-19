// Shared ID scheme across the app: a role prefix plus 6 random digits
// (e.g. "T-482913" for a therapist/staff member, "P-118204" for a patient),
// checked against whatever IDs are already in use so two records never
// collide. `existingIds` accepts any iterable of existing id strings.
export function generateUniqueId(prefix, existingIds = []) {
  const used = existingIds instanceof Set ? existingIds : new Set(existingIds)
  let id
  do {
    const digits = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    id = `${prefix}-${digits}`
  } while (used.has(id))
  return id
}
