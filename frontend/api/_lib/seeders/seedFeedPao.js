// Inserts the Feed Pao game (as a draft). Idempotent: skips it if it exists.
//   node api/_lib/seeders/seedFeedPao.js
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

const food = (key, label, extra = {}) => ({
  label,
  choice_key: key,
  image_url: `/games/feed-pao/food/${key.replace(/ /g, '-')}.svg`,
  is_correct: false,
  ...extra,
})
const right = (key, label, step) => food(key, label, { is_correct: true, ...(step ? { step: new Int32(step) } : {}) })

const LEVELS = [
  {
    level_order: new Int32(1), level_name: 'One step', prompt_level: 'full_model', items: [
      { question: 'Give Pao the banana.', text: 'Give Pao the banana.', choices: [right('banana', 'banana'), food('milk', 'milk'), food('carrot', 'carrot')] },
      { question: 'Give Pao the milk.', text: 'Give Pao the milk.', choices: [food('banana', 'banana'), right('milk', 'milk'), food('carrot', 'carrot')] },
      { question: 'Give Pao the carrot.', text: 'Give Pao the carrot.', choices: [food('banana', 'banana'), food('milk', 'milk'), right('carrot', 'carrot')] },
    ],
  },
  {
    level_order: new Int32(2), level_name: 'Look closely', prompt_level: 'partial', items: [
      { question: 'Give Pao the red apple.', text: 'Give Pao the red apple.', choices: [right('red apple', 'red apple'), food('green apple', 'green apple'), food('bread', 'bread')] },
      { question: 'Give Pao the green apple.', text: 'Give Pao the green apple.', choices: [food('red apple', 'red apple'), right('green apple', 'green apple'), food('carrot', 'carrot')] },
    ],
  },
  {
    level_order: new Int32(3), level_name: 'Two steps', prompt_level: 'partial', items: [
      { question: 'Give Pao the banana, then the milk.', text: 'Give Pao the banana, then the milk.', choices: [right('banana', 'banana', 1), right('milk', 'milk', 2), food('bread', 'bread')] },
      { question: 'Give Pao the bread, then the water.', text: 'Give Pao the bread, then the water.', choices: [right('bread', 'bread', 1), right('water', 'water', 2), food('milk', 'milk')] },
    ],
  },
]

async function main() {
  await getMongo()
  const db = await getDb()
  const now = new Date()

  if (await db.collection('games').findOne({ name: 'Feed Pao' })) {
    console.log('Feed Pao already exists, left unchanged')
    process.exit(0)
  }

  const admin = (await db.collection('users').findOne({ role: 'Super Admin' })) || (await db.collection('users').findOne({}))
  if (!admin) throw new Error('No user found to set as created_by.')

  await db.collection('games').insertOne({
    name: 'Feed Pao',
    description: 'Listen to Pao, then give him the right food, one step at a time.',
    therapy_type: 'speech',
    difficulty: 'easy',
    game_type: 'choose_picture',
    age_range: { min: new Int32(8), max: new Int32(15) },
    points_per_play: new Int32(100),
    unlocks_badge_id: null,
    unlock_level: new Int32(1),
    stat_gains: { memory: new Int32(1), focus: new Int32(1), intelligence: new Int32(0), resistance: new Int32(0), creativity: new Int32(0), speed: new Int32(0) },
    therapist_note: 'Trains following one-step and two-step directions and listening memory.',
    type_settings: { choose_picture: { choices: new Int32(3), show_words_default: true } },
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
  console.log('Inserted Feed Pao as a draft')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
