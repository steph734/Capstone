// GET /api/owner/gamified/library?email=
// -> every game in the `games` collection (published, draft and archived),
// each with this month's usage (completed sessions in the last 30 days across
// ALL branches): plays, average accuracy, distinct patients, average session
// length, top patients, and when it was last played. Owner role is checked
// on the server.
import { getMongo } from '../mongo.js'
import { requireOwner, manilaMidnightUtc, weightedAccuracy, round1 } from '../ownerGamified.js'

const STAT_LABEL = { intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance', creativity: 'Creativity', speed: 'Speed', memory: 'Memory' }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireOwner(req, res)
    if (!ctx) return
    const { db } = ctx
    const from = manilaMidnightUtc(29)
    const toExclusive = manilaMidnightUtc(-1)

    const [games, sessions, lastAgg] = await Promise.all([
      db.collection('games').find({}).sort({ name: 1 }).toArray(),
      db.collection('game_sessions').find({ status: 'completed', completed_at: { $gte: from, $lt: toExclusive } },
        { projection: { game_id: 1, patient_id: 1, result: 1, completed_at: 1 } }).toArray(),
      db.collection('game_sessions').aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$game_id', last: { $max: '$completed_at' } } },
      ]).toArray(),
    ])
    const lastBy = new Map(lastAgg.map((l) => [String(l._id), l.last]))
    const byGame = new Map()
    for (const s of sessions) {
      const k = String(s.game_id)
      if (!byGame.has(k)) byGame.set(k, [])
      byGame.get(k).push(s)
    }

    // Names for each game's top patients.
    const topByGame = new Map()
    const wantedIds = new Map()
    for (const [gid, ss] of byGame) {
      const counts = new Map()
      for (const s of ss) counts.set(String(s.patient_id), (counts.get(String(s.patient_id)) || 0) + 1)
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      topByGame.set(gid, top)
      top.forEach(([pid]) => wantedIds.set(pid, null))
    }
    const patients = wantedIds.size
      ? await db.collection('patients').find({ _id: { $in: [...wantedIds.keys()].map((id) => sessions.find((s) => String(s.patient_id) === id).patient_id) } }, { projection: { first_name: 1, last_name: 1 } }).toArray()
      : []
    const nameBy = new Map(patients.map((p) => [String(p._id), [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown']))

    const out = games.map((g) => {
      const id = String(g._id)
      const ss = byGame.get(id) || []
      const acc = weightedAccuracy(ss)
      const durations = ss.map((s) => s.result?.duration_seconds).filter((d) => Number.isFinite(d) && d > 0)
      const gains = Object.entries(g.stat_gains || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => ({ key: k, label: STAT_LABEL[k] || k, value: Number(v) }))
      return {
        id,
        name: g.name || 'Untitled',
        description: g.description || '',
        therapyType: g.therapy_type || null,
        difficulty: g.difficulty || null,
        gameType: g.game_type || null,
        ageRange: g.age_range && (g.age_range.min != null || g.age_range.max != null) ? { min: g.age_range.min ?? null, max: g.age_range.max ?? null } : null,
        status: g.status || 'draft',
        testPlayed: !!g.test_played,
        therapistNote: g.therapist_note || '',
        pointsPerPlay: Number(g.points_per_play) || 0,
        unlockLevel: Number(g.unlock_level) || 1,
        levelCount: Array.isArray(g.levels) ? g.levels.length : 0,
        statGains: gains,
        createdAt: g.published_at || g.created_at || null,
        usage: {
          plays: ss.length,
          accuracy: acc === null ? null : Math.round(acc),
          patients: new Set(ss.map((s) => String(s.patient_id))).size,
          avgMinutes: durations.length ? round1(durations.reduce((a, b) => a + b, 0) / durations.length / 60) : null,
          lastPlayedAt: lastBy.get(id) || null,
          topPatients: (topByGame.get(id) || []).map(([pid, plays]) => ({ name: nameBy.get(pid) || 'Unknown', plays })),
        },
      }
    })
    return res.status(200).json({ games: out, period: { days: 30, from: from.toISOString(), to: toExclusive.toISOString() } })
  } catch (err) {
    console.error('owner/gamified/library error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the activity library.' })
  }
}
