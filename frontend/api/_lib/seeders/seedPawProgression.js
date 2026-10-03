// Seeds the Pao progression content: the starter badges, each game's Pao
// unlock_level and stat_gains, and keeps games.unlocks_badge_id in sync with
// every complete_specific_game badge. Idempotent — safe to re-run.
//   node api/_lib/seeders/seedPawProgression.js
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

// Pao level each game unlocks at. Keyed by the game's name in the games collection.
const UNLOCK_LEVEL_BY_NAME = {
  'Puzzle Pals': 1,
  'Picture-Word Matching': 1,
  'Sort the Basket': 1,
  'Story Builder': 1,
  'Slow-Motion Echo': 2,
  'Sound Hunt': 3,
  'Sentence Builder': 5,
  'Rhyme Time': 7,
  'Alphabet Blast': 12,
}

// Stat gains by game type — the same fallback the server uses when a game has
// no explicit stat_gains of its own.
const STAT_GAINS_BY_TYPE = {
  picture_match: { memory: 2, focus: 2 },
  sort_place: { intelligence: 2, focus: 2 },
  choose_picture: { intelligence: 2, focus: 2 },
  step_by_step: { memory: 2, resistance: 2 },
  say_it: { creativity: 2, resistance: 2 },
  move_with_me: { speed: 2, resistance: 2 },
}

const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const fullStatGains = (partial = {}) => Object.fromEntries(STAT_KEYS.map((k) => [k, new Int32(partial[k] || 0)]))

const starterBadges = (now) => [
  {
    code: 'explorer',
    name: 'Explorer',
    description: 'Finished 10 games.',
    emoji: '🧭',
    art: { shape: 'star', color: 'teal', symbol: 'footprints', banner: false },
    criteria: { type: 'complete_any_game', game_id: null, value: new Int32(10) },
  },
  {
    code: 'super_streak',
    name: 'Super Streak',
    description: 'Finished 5 games in a row without stopping.',
    emoji: '🔥',
    art: { shape: 'diamond', color: 'orange', symbol: 'bolt', banner: false },
    criteria: { type: 'games_in_a_row', game_id: null, value: new Int32(5) },
  },
  {
    code: 'all_rounder',
    name: 'All-Rounder',
    description: 'Tried every therapy game category.',
    emoji: '🌈',
    art: { shape: 'flower', color: 'purple', symbol: 'trophy', banner: true },
    criteria: { type: 'all_categories', game_id: null, value: null },
  },
].map((b, i) => ({
  ...b,
  icon_url: null,
  theme_code: null,
  unlock_item_type: null,
  unlock_item_code: null,
  is_active: true,
  sort_order: new Int32(i + 1),
  created_by: null,
  status: 'active',
  is_archived: false,
  is_deleted: false,
  earned_count: new Int32(0),
  created_at: now,
  updated_at: now,
}))

async function main() {
  await getMongo()
  const db = await getDb()
  const now = new Date()

  const games = await db.collection('games').find({}).toArray()
  let gamesUpdated = 0
  for (const g of games) {
    const set = {}
    const level = UNLOCK_LEVEL_BY_NAME[g.name]
    if (level) set.unlock_level = new Int32(level)
    const gains = STAT_GAINS_BY_TYPE[g.game_type]
    if (gains) set.stat_gains = fullStatGains(gains)
    if (Object.keys(set).length) {
      await db.collection('games').updateOne({ _id: g._id }, { $set: set })
      gamesUpdated += 1
    }
  }

  for (const badge of starterBadges(now)) {
    const exists = await db.collection('badges').findOne({ code: badge.code })
    if (exists) continue
    await db.collection('badges').insertOne(badge)
  }

  // Keep games.unlocks_badge_id pointing at each complete_specific_game badge's game.
  const specific = await db.collection('badges').find({ 'criteria.type': 'complete_specific_game', 'criteria.game_id': { $ne: null } }).toArray()
  for (const b of specific) {
    await db.collection('games').updateOne({ _id: b.criteria.game_id }, { $set: { unlocks_badge_id: b._id } })
  }

  console.log(`Games with Pao settings: ${gamesUpdated}. Badges now: ${await db.collection('badges').countDocuments()}. Game→badge links synced: ${specific.length}.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
