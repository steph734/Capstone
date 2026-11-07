import { getDb } from './mongo.js'

// A guardian's account can end up linked to more than one `patients` record (the same child registered
// twice). The one that is actually in use wins: today's/recent game plans first, then game plays, then Pao XP.
// With a single record this is just a lookup.
export async function pickPatientByEmail(db, email, projection) {
  const lower = String(email || '').trim().toLowerCase()
  if (!lower) return null
  const rows = await db.collection('patients').find({ email: lower }).sort({ created_at: 1 }).toArray()
  if (rows.length <= 1) return rows[0] || null
  const ids = rows.map((r) => r._id)
  const [plans, plays, profiles] = await Promise.all([
    db.collection('session_game_plans').aggregate([{ $match: { patient_id: { $in: ids }, status: { $ne: 'cancelled' } } }, { $group: { _id: '$patient_id', n: { $sum: 1 }, last: { $max: '$plan_date' } } }]).toArray(),
    db.collection('game_sessions').aggregate([{ $match: { patient_id: { $in: ids } } }, { $group: { _id: '$patient_id', n: { $sum: 1 } } }]).toArray(),
    db.collection('pao_profiles').find({ patient_id: { $in: ids } }, { projection: { total_xp: 1, xp: 1 } }).toArray(),
  ])
  const by = (list, f) => new Map(list.map((x) => [String(x._id ?? x.patient_id), f(x)]))
  const planScore = by(plans, (x) => 1000 + x.n * 10 + (x.last ? Math.floor(x.last.getTime() / 86400000) / 1e6 : 0))
  const playScore = by(plays, (x) => x.n)
  const xpScore = by(profiles, (x) => (x.total_xp || x.xp || 0) / 1000)
  const score = (r) => (planScore.get(String(r._id)) || 0) + (playScore.get(String(r._id)) || 0) + (xpScore.get(String(r._id)) || 0)
  const best = [...rows].sort((a, b) => score(b) - score(a))[0]
  return projection ? Object.fromEntries(Object.keys(projection).map((k) => [k, best[k]]).concat([['_id', best._id]])) : best
}

// There's no Mongoose model for `patients` (it's read/written by several
// features via the raw driver already), so this looks the patient up by the
// email on their own account — the same email stored on their `users` doc.
export async function resolvePatientId(email) {
  const db = await getDb()
  const patient = await pickPatientByEmail(db, email, { _id: 1 })
  return patient ? patient._id : null
}
