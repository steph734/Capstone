// Super Admin search / filter / sort for the Badge library.
//   GET /api/admin/badges?q=&game=<gameId|milestone>&vis=&type=&archived=&sort=&page=&limit=
//       -> { items: [{ id, gameId, gameName, howToEarn, earned }], total, counts: { all, game, milestone, hidden, active, archived }, page, pages }
//       chip counts (all/game/milestone/hidden) follow q, game, vis AND the Active/Archived toggle;
//       active/archived follow q, game and vis only.
//   GET /api/admin/badges/games -> { games: [{ gameId, name, count }], milestones, total }
// "Earned N×" is the number of patients who earned the badge: a group-by on patient_badges, cached for 5 minutes.
// Search is plain substring matching on normalised text (no regular expression is built from user input).
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const clean = (v, max = 80) => String(v ?? '').slice(0, max)

let earnedCache = { at: 0, map: new Map() }
async function earnedByBadge(db) {
  if (Date.now() - earnedCache.at < 5 * 60 * 1000) return earnedCache.map
  const rows = await db.collection('patient_badges').aggregate([{ $group: { _id: '$badge_id', n: { $sum: 1 } } }]).toArray()
  earnedCache = { at: Date.now(), map: new Map(rows.map((r) => [String(r._id), r.n])) }
  return earnedCache.map
}

function howToEarn(c, gameName) {
  const v = c?.value
  switch (c?.type) {
    case 'complete_specific_game': return `Finish ${gameName || 'a specific game'}`
    case 'complete_any_game': return 'Finish any game for the first time'
    case 'perfect_score': return 'Get every answer right on the first try'
    case 'reach_level': return `Reach level ${v ?? '?'}`
    case 'total_xp': return `Earn ${v ?? '?'} XP`
    case 'games_in_a_row': return `Play ${v ?? '?'} days in a row`
    case 'all_categories': return 'Try every therapy game category'
    default: return ''
  }
}

async function loadBadges(db) {
  const [docs, games, earned] = await Promise.all([
    db.collection('badges').find({ is_deleted: { $ne: true }, status: { $ne: 'deleted' } }).toArray(),
    db.collection('games').find({}).project({ name: 1 }).toArray(),
    earnedByBadge(db),
  ])
  const gameName = new Map(games.map((g) => [String(g._id), g.name]))
  return docs.map((d) => {
    const gid = d.criteria?.type === 'complete_specific_game' && d.criteria.game_id ? String(d.criteria.game_id) : null
    const gname = gid ? gameName.get(gid) || null : null
    return {
      id: String(d._id), name: d.name || '', description: d.description || '',
      gameId: gname ? gid : null, gameName: gname, howTo: howToEarn(d.criteria, gname),
      type: gid ? 'game' : 'milestone', active: d.is_active !== false, archived: Boolean(d.is_archived || d.status === 'archived'),
      earned: earned.get(String(d._id)) ?? Number(d.earned_count || 0), created: d.created_at ? new Date(d.created_at).getTime() : 0,
    }
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const all = await loadBadges(ctx.db)

    if (req.params?.sub === 'games') {
      const live = all.filter((b) => !b.archived)
      const by = new Map()
      for (const b of live) if (b.gameId) by.set(b.gameId, { gameId: b.gameId, name: b.gameName, count: (by.get(b.gameId)?.count || 0) + 1 })
      return res.status(200).json({ games: [...by.values()].sort((a, b) => a.name.localeCompare(b.name)), milestones: live.filter((b) => !b.gameId).length, total: live.length })
    }

    const q = norm(clean(req.query.q, 100))
    const game = clean(req.query.game, 40)
    const vis = ['active', 'hidden'].includes(req.query.vis) ? req.query.vis : 'all'
    const type = ['game', 'milestone', 'hidden'].includes(req.query.type) ? req.query.type : 'all'
    const archived = req.query.archived === '1'
    const sort = ['earned-desc', 'earned-asc', 'name-asc', 'name-desc', 'newest', 'oldest', 'game-asc'].includes(req.query.sort) ? req.query.sort : 'earned-desc'
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24))
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)

    const base = all.filter((b) => {
      if (q && !norm(`${b.name} ${b.description} ${b.howTo} ${b.gameName || ''}`).includes(q)) return false
      if (game === 'milestone' && b.gameId) return false
      if (game && game !== 'milestone' && b.gameId !== game) return false
      if (vis === 'active' && !b.active) return false
      if (vis === 'hidden' && b.active) return false
      return true
    })
    const inView = base.filter((b) => b.archived === archived)
    const counts = {
      all: inView.length, game: inView.filter((b) => b.type === 'game').length, milestone: inView.filter((b) => b.type === 'milestone').length,
      hidden: inView.filter((b) => !b.active).length, active: base.filter((b) => !b.archived).length, archived: base.filter((b) => b.archived).length,
    }
    const list = inView.filter((b) => type === 'all' || (type === 'hidden' ? !b.active : b.type === type))

    const byName = (a, b) => a.name.localeCompare(b.name)
    const sorters = {
      'earned-desc': (a, b) => b.earned - a.earned || byName(a, b), 'earned-asc': (a, b) => a.earned - b.earned || byName(a, b),
      'name-asc': byName, 'name-desc': (a, b) => byName(b, a), newest: (a, b) => b.created - a.created, oldest: (a, b) => a.created - b.created,
      'game-asc': (a, b) => (!a.gameName && !b.gameName ? byName(a, b) : !a.gameName ? 1 : !b.gameName ? -1 : a.gameName.localeCompare(b.gameName) || byName(a, b)),
    }
    list.sort(sorters[sort])
    const items = list.slice((page - 1) * limit, page * limit).map((b) => ({ id: b.id, gameId: b.gameId, gameName: b.gameName, howToEarn: b.howTo, earned: b.earned }))
    return res.status(200).json({ items, total: list.length, counts, page, pages: Math.max(1, Math.ceil(list.length / limit)) })
  } catch (err) {
    console.error('admin badges failed:', err)
    return res.status(500).json({ error: 'Could not load the badge library.' })
  }
}
