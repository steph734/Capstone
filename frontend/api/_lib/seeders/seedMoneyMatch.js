// Inserts the Money Match game (as a draft) and its badge into the live
// database. Idempotent: skips anything that already exists by name / code.
//   node api/_lib/seeders/seedMoneyMatch.js
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const statGains = (partial) => Object.fromEntries(STAT_KEYS.map((k) => [k, new Int32(partial[k] || 0)]))

const bill = (value, zone_key = 'wallet') => ({
  label: `${value} peso bill`,
  text: `${value} pesos`,
  image_url: `/games/money-match/bill-${value}.webp`,
  zone_key,
})
const coin = (value, zone_key = 'purse') => ({
  label: `${value} peso coin`,
  text: `${value} pesos`,
  image_url: `/games/money-match/coin-${value}.webp`,
  zone_key,
})

const LEVELS = [
  {
    level_order: new Int32(1),
    level_name: 'Warm-up',
    prompt_level: 'full_model',
    items: [bill(20), bill(50), bill(100)],
  },
  {
    level_order: new Int32(2),
    level_name: 'All the money',
    prompt_level: 'partial',
    items: [bill(20), bill(50), bill(100), bill(200), bill(500), bill(1000), coin(1), coin(5), coin(10), coin(20)],
  },
]

async function main() {
  await getMongo()
  const db = await getDb()
  const now = new Date()

  const admin = (await db.collection('users').findOne({ role: 'Super Admin' })) || (await db.collection('users').findOne({}))
  if (!admin) throw new Error('No user found to set as created_by.')

  let badgeId = null
  if (!(await db.collection('badges').findOne({ code: 'money_match' }))) {
    const r = await db.collection('badges').insertOne({
      code: 'money_match',
      name: 'Money Match',
      description: 'Finished Money Match.',
      emoji: '💵',
      icon_url: null,
      theme_code: null,
      art: { shape: 'circle', color: 'green', symbol: 'gem', banner: false },
      criteria: { type: 'complete_specific_game', game_id: null, value: null },
      unlock_item_type: null,
      unlock_item_code: null,
      is_active: true,
      sort_order: new Int32(90),
      created_by: admin._id,
      status: 'active',
      is_archived: false,
      is_deleted: false,
      earned_count: new Int32(0),
      created_at: now,
      updated_at: now,
    })
    badgeId = r.insertedId
    console.log('Created badge money_match')
  } else {
    badgeId = (await db.collection('badges').findOne({ code: 'money_match' }))._id
  }

  let game = await db.collection('games').findOne({ name: 'Money Match' })
  if (!game) {
    const r = await db.collection('games').insertOne({
      name: 'Money Match',
      description: 'Sort the money! Put the bills in the wallet, then the coins in the coin purse.',
      therapy_type: 'cognitive',
      difficulty: 'easy',
      game_type: 'sort_place',
      age_range: { min: new Int32(8), max: new Int32(19) },
      points_per_play: new Int32(100),
      unlocks_badge_id: badgeId,
      unlock_level: new Int32(1),
      stat_gains: statGains({ intelligence: 1, memory: 1 }),
      therapist_note: 'Teaches the difference between coins and bills, and where each one goes.',
      type_settings: {
        sort_place: {
          snap_help: 'strong',
          show_target_outlines: true,
          sequence: 'zone_by_zone',
          zones: [
            { zone_key: 'wallet', label: 'Wallet', color: '#8A5A3B' },
            { zone_key: 'purse', label: 'Coin purse', color: '#F06FA0' },
          ],
        },
      },
      levels: LEVELS,
      support: {
        target_size: 'extra_large',
        pace: 'no_timer',
        prompt_level: 'full_model',
        read_aloud: true,
        picture_cues: true,
        simple_words: true,
        errorless_learning: true,
        fade_prompts: true,
        calm_visuals: true,
        reward_style: 'stars',
        session_minutes: new Int32(10),
      },
      status: 'draft',
      test_played: false,
      created_by: admin._id,
      updated_by: null,
      published_at: null,
      created_at: now,
      updated_at: now,
    })
    game = { _id: r.insertedId }
    console.log('Inserted Money Match as a draft')
  } else {
    console.log('Money Match already exists — left unchanged')
  }

  await db.collection('badges').updateOne({ code: 'money_match' }, { $set: { 'criteria.game_id': game._id } })
  await db.collection('games').updateOne({ _id: game._id }, { $set: { unlocks_badge_id: badgeId } })
  console.log('Linked the badge and the game.')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
