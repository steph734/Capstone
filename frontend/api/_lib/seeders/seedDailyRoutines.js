// Inserts the Daily Routines game (as a draft) with its five task badges.
// Idempotent: skips anything that already exists by name / code.
//   node api/_lib/seeders/seedDailyRoutines.js
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const statGains = (partial) => Object.fromEntries(STAT_KEYS.map((k) => [k, new Int32(partial[k] || 0)]))
const img = (key) => `/games/daily-routines/${key}.svg`

// Each task: steps are [picture key, card text (Pao says "Next, <text>!")].
const TASKS = [
  { task_key: 'morning', name: 'Morning Routine', min_age: 8, safety: false, badge_code: 'early_bird', finish_text: 'Ready for school!', color: '#FFF4DE',
    steps: [['morning-wake', 'wake up'], ['morning-bath', 'take a bath'], ['morning-dress', 'get dressed'], ['morning-breakfast', 'eat breakfast'], ['morning-teeth', 'brush our teeth'], ['morning-pack', 'pack our bag']],
    levels: [
      { level_name: 'Warm-up', prompt_level: 'full_model', count: 3 },
      { level_name: 'Getting ready', prompt_level: 'partial', count: 4 },
      { level_name: 'All of it', prompt_level: 'none', count: 6 },
    ] },
  { task_key: 'handwashing', name: 'Wash Your Hands', min_age: 8, safety: false, badge_code: 'clean_hands', finish_text: 'Clean hands!', color: '#E0F2FE',
    steps: [['hands-wet', 'wet our hands'], ['hands-soap', 'get soap'], ['hands-scrub', 'scrub'], ['hands-rinse', 'rinse'], ['hands-dry', 'dry our hands']],
    levels: [
      { level_name: 'Warm-up', prompt_level: 'full_model', count: 5 },
      { level_name: 'All', prompt_level: 'partial', count: 5 },
    ] },
  { task_key: 'egg', name: 'Cook an Egg', min_age: 12, safety: true, badge_code: 'little_chef', finish_text: 'Breakfast is ready!', color: '#FEF9C3',
    steps: [['egg-get', 'get an egg'], ['egg-crack', 'crack it in the bowl'], ['egg-cook', 'cook it in the pan'], ['egg-plate', 'put it on the plate']],
    levels: [
      { level_name: 'Warm-up', prompt_level: 'full_model', count: 4 },
      { level_name: 'All', prompt_level: 'partial', count: 4 },
    ] },
  { task_key: 'sandwich', name: 'Make a Sandwich', min_age: 8, safety: false, badge_code: 'snack_maker', finish_text: 'Yummy sandwich!', color: '#FFEDD5',
    steps: [['sandwich-bread', 'get two slices of bread'], ['sandwich-spread', 'spread the peanut butter'], ['sandwich-filling', 'add the jam'], ['sandwich-close', 'close the sandwich']],
    levels: [
      { level_name: 'Warm-up', prompt_level: 'full_model', count: 4 },
      { level_name: 'All', prompt_level: 'partial', count: 4 },
    ] },
  { task_key: 'bedtime', name: 'Bedtime', min_age: 8, safety: false, badge_code: 'sweet_dreams', finish_text: 'Sweet dreams!', color: '#E0E7FF',
    steps: [['bed-pyjamas', 'put on our pyjamas'], ['bed-teeth', 'brush our teeth'], ['bed-story', 'read a story'], ['bed-light', 'turn off the light']],
    levels: [
      { level_name: 'Warm-up', prompt_level: 'full_model', count: 4 },
      { level_name: 'All', prompt_level: 'partial', count: 4 },
    ] },
]

const BADGES = [
  { code: 'early_bird', name: 'Early Bird', emoji: '🌅', description: 'Finished the Morning Routine.', task_key: 'morning', color: 'yellow' },
  { code: 'clean_hands', name: 'Clean Hands', emoji: '🧼', description: 'Finished Wash Your Hands.', task_key: 'handwashing', color: 'blue' },
  { code: 'little_chef', name: 'Little Chef', emoji: '🍳', description: 'Finished Cook an Egg.', task_key: 'egg', color: 'orange' },
  { code: 'snack_maker', name: 'Snack Maker', emoji: '🥪', description: 'Finished Make a Sandwich.', task_key: 'sandwich', color: 'orange' },
  { code: 'sweet_dreams', name: 'Sweet Dreams', emoji: '🌙', description: 'Finished Bedtime.', task_key: 'bedtime', color: 'purple' },
]

// Each level's items are the first `count` steps of its task, in order.
function buildLevels() {
  const levels = []
  let order = 1
  for (const t of TASKS) {
    for (const lv of t.levels) {
      levels.push({
        level_order: new Int32(order++),
        level_name: lv.level_name,
        task_key: t.task_key,
        prompt_level: lv.prompt_level,
        items: t.steps.slice(0, lv.count).map(([key, text], i) => ({
          label: text.replace(/^./, (c) => c.toUpperCase()),
          text,
          image_url: img(key),
          step_order: new Int32(i + 1),
        })),
      })
    }
  }
  return levels
}

async function main() {
  await getMongo()
  const db = await getDb()
  const now = new Date()

  const admin = (await db.collection('users').findOne({ role: 'Super Admin' })) || (await db.collection('users').findOne({}))
  if (!admin) throw new Error('No user found to set as created_by.')

  let game = await db.collection('games').findOne({ name: 'Daily Routines' })
  if (!game) {
    const r = await db.collection('games').insertOne({
      name: 'Daily Routines',
      description: 'Put the pictures of everyday routines in the right order, one step at a time.',
      therapy_type: 'occupational',
      difficulty: 'easy',
      game_type: 'step_by_step',
      age_range: { min: new Int32(8), max: new Int32(19) },
      points_per_play: new Int32(100),
      unlocks_badge_id: null,
      unlock_level: new Int32(1),
      stat_gains: statGains({ focus: 1, intelligence: 1 }),
      therapist_note: 'Builds the order of everyday routines. Cook an Egg is for ages 12 and up and needs a grown-up.',
      type_settings: {
        step_by_step: {
          show_step_numbers: true,
          tasks: TASKS.map((t) => ({
            task_key: t.task_key,
            name: t.name,
            min_age: new Int32(t.min_age),
            safety: t.safety,
            badge_code: t.badge_code,
            finish_text: t.finish_text,
            cover_image: img(t.steps[0][0]),
            color: t.color,
          })),
        },
      },
      levels: buildLevels(),
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
    console.log('Inserted Daily Routines as a draft')
  } else {
    console.log('Daily Routines already exists, left unchanged')
  }

  for (const b of BADGES) {
    if (await db.collection('badges').findOne({ code: b.code })) {
      console.log(`Badge ${b.code} exists, left unchanged`)
      continue
    }
    await db.collection('badges').insertOne({
      code: b.code,
      name: b.name,
      description: b.description,
      emoji: b.emoji,
      icon_url: null,
      theme_code: null,
      art: { shape: 'circle', color: b.color, symbol: 'gem', banner: false },
      criteria: { type: 'complete_specific_game', game_id: game._id, value: new Int32(1), task_key: b.task_key },
      unlock_item_type: null,
      unlock_item_code: null,
      is_active: true,
      sort_order: new Int32(91),
      created_by: admin._id,
      status: 'active',
      is_archived: false,
      is_deleted: false,
      earned_count: new Int32(0),
      created_at: now,
      updated_at: now,
    })
    console.log(`Created badge ${b.code}`)
  }

  console.log('Done. Publish after test play: set status to "published".')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
