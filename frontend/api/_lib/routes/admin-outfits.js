// Super Admin search / filter / sort for Pao's wardrobe (clothes + pao_hair).
//   GET /api/admin/outfits?q=&game=<gameId|none>&status=&category=&sort=&page=&limit=
//       -> { items: [{ id, source, gameId, gameName }], total, counts: { all, hair, hats, clothes, pants, shoes }, page, pages }
//       counts respect q, game and status (not category).
//   GET /api/admin/outfits/games -> { games: [{ gameId, name, count }], notLinked, total }
// An outfit's "unlock game" is the game on its own unlock rule, or else the game of the active badge that unlocks it.
// Game names are looked up live from the games collection, so a renamed game updates everywhere. Search is plain
// substring matching on normalised text (no regular expression is ever built from user input).
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

const CATS = ['hair', 'hats', 'clothes', 'pants', 'shoes']
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const clean = (v, max = 80) => String(v ?? '').slice(0, max)

async function loadOutfits(db) {
  const [clothes, hair, badges, games] = await Promise.all([
    db.collection('clothes').find({}).toArray(),
    db.collection('pao_hair').find({}).toArray(),
    db.collection('badges').find({ is_active: true, is_archived: { $ne: true }, unlock_item_code: { $ne: null } }).project({ unlock_item_code: 1, criteria: 1, name: 1 }).toArray(),
    db.collection('games').find({}).project({ name: 1 }).toArray(),
  ])
  const gameName = new Map(games.map((g) => [String(g._id), g.name]))
  const badgeGame = new Map()
  for (const b of badges) {
    if (b.criteria?.type === 'complete_specific_game' && b.criteria.game_id && !badgeGame.has(b.unlock_item_code)) badgeGame.set(b.unlock_item_code, String(b.criteria.game_id))
  }
  const make = (doc, source, category) => {
    const own = doc.unlock?.type === 'complete_specific_game' && doc.unlock.game_id ? String(doc.unlock.game_id) : null
    const gameId = own || badgeGame.get(doc.code) || null
    const name = gameId ? gameName.get(gameId) || null : null
    return {
      id: String(doc._id), source, code: doc.code, name: doc.name || '', description: doc.description || '', category,
      gameId: name ? gameId : null, gameName: name, custom: Boolean(doc.design || source === 'hair'),
      created: doc.created_at ? new Date(doc.created_at).getTime() : 0,
    }
  }
  return [...clothes.map((d) => make(d, 'items', d.category)), ...hair.map((d) => make(d, 'hair', 'hair'))]
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const all = await loadOutfits(ctx.db)

    if (req.params?.sub === 'games') {
      const by = new Map()
      for (const o of all) if (o.gameId) by.set(o.gameId, { gameId: o.gameId, name: o.gameName, count: (by.get(o.gameId)?.count || 0) + 1 })
      return res.status(200).json({ games: [...by.values()].sort((a, b) => a.name.localeCompare(b.name)), notLinked: all.filter((o) => !o.gameId).length, total: all.length })
    }

    const q = norm(clean(req.query.q, 100))
    const game = clean(req.query.game, 40)
    const status = ['linked', 'free', 'custom'].includes(req.query.status) ? req.query.status : 'all'
    const category = CATS.includes(String(req.query.category || '').toLowerCase()) ? String(req.query.category).toLowerCase() : 'all'
    const sort = ['game-asc', 'game-desc', 'name-asc', 'name-desc', 'newest', 'oldest', 'category'].includes(req.query.sort) ? req.query.sort : 'game-asc'
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24))
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)

    const base = all.filter((o) => {
      if (q && !norm(`${o.name} ${o.description} ${o.category} ${o.gameName || ''}`).includes(q)) return false
      if (game === 'none' && o.gameId) return false
      if (game && game !== 'none' && o.gameId !== game) return false
      if (status === 'linked' && !o.gameId) return false
      if (status === 'free' && o.gameId) return false
      if (status === 'custom' && !o.custom) return false
      return true
    })
    const counts = { all: base.length, ...Object.fromEntries(CATS.map((c) => [c, base.filter((o) => o.category === c).length])) }
    const list = base.filter((o) => category === 'all' || o.category === category)

    const byName = (a, b) => a.name.localeCompare(b.name)
    const byGame = (dir) => (a, b) => {
      if (!a.gameName && !b.gameName) return byName(a, b)
      if (!a.gameName) return 1 // items with no game go last
      if (!b.gameName) return -1
      return dir * a.gameName.localeCompare(b.gameName) || byName(a, b)
    }
    const sorters = {
      'game-asc': byGame(1), 'game-desc': byGame(-1), 'name-asc': byName, 'name-desc': (a, b) => byName(b, a),
      newest: (a, b) => b.created - a.created, oldest: (a, b) => a.created - b.created,
      category: (a, b) => CATS.indexOf(a.category) - CATS.indexOf(b.category) || byName(a, b),
    }
    list.sort(sorters[sort])
    const total = list.length
    const items = list.slice((page - 1) * limit, page * limit).map((o) => ({ id: o.id, source: o.source, gameId: o.gameId, gameName: o.gameName }))
    return res.status(200).json({ items, total, counts, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    console.error('admin outfits failed:', err)
    return res.status(500).json({ error: 'Could not load the wardrobe.' })
  }
}
