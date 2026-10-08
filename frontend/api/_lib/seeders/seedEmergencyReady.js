// Inserts Emergency Ready (a draft, hard difficulty) with its 24 levels
// (6 emergencies x 4 parts) and the "Safety Star" badge. If "Earthquake
// Ready" already exists, it is renamed and its levels replaced; everything
// else (status, badge link) is left as-is.
//   node api/_lib/seeders/seedEmergencyReady.js
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

const statGains = (partial) => Object.fromEntries(
  ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory'].map((k) => [k, new Int32(partial[k] || 0)])
)
const img = (folder, key) => `/games/emergency-ready/${folder}/${key}.svg`

// ─── The 6 emergencies: picker card + intro + end-screen content ────────────
const EMERGENCIES = [
  {
    emergency_key: 'earthquake', name: 'Earthquake', rule: 'Drop, cover, hold on', color: '#E6F0FF', border: '#B8CCF2',
    intro_title: 'What is an earthquake?',
    intro_lines: ['An earthquake is when the ground shakes.', 'It can happen without warning.', 'We know what to do to stay safe.'],
    signs: ['The ground shakes', 'Things fall off shelves', 'Windows and doors rattle'],
    puzzles: [
      { part_no: new Int32(1), type: 'order', title: 'Drop, Cover, Hold On', description: 'Put the steps in order' },
      { part_no: new Int32(2), type: 'safe_or_not', description: 'Is it safe?' },
      { part_no: new Int32(3), type: 'choose', description: 'What do we do?' },
      { part_no: new Int32(4), type: 'sort', description: 'Pack the go-bag' },
    ],
    end_summary: [
      { title: 'While it shakes', text: 'Drop down, cover your head and neck, and hold on until it stops.' },
      { title: 'Stay away from', text: 'Windows, mirrors, and tall furniture that can fall.' },
      { title: 'After it stops', text: 'Check for danger, then go to your family meeting place.' },
    ],
  },
  {
    emergency_key: 'fire', name: 'Fire', rule: 'Get out and stay out', color: '#FDE7E6', border: '#F2B8B5',
    intro_title: 'What is a fire?',
    intro_lines: ['A fire is when something burns.', 'Smoke can make it hard to breathe.', 'We know how to get out safely.'],
    signs: ['Smoke', 'A burning smell', 'The fire alarm rings'],
    puzzles: [
      { part_no: new Int32(1), type: 'order', title: 'Get low, get out', description: 'Put the escape steps in order' },
      { part_no: new Int32(2), type: 'safe_or_not', description: 'Is it safe?' },
      { part_no: new Int32(3), type: 'choose', description: 'Call for help' },
      { part_no: new Int32(4), type: 'sort', description: 'Pack the go-bag' },
    ],
    end_summary: [
      { title: 'While it burns', text: 'Shout "Fire!", get low under smoke, and get out. Never hide.' },
      { title: 'Never do this', text: 'Never go back inside for anything, not even a pet or a toy.' },
      { title: 'Once outside', text: 'Go to your meeting place and call for help.' },
    ],
  },
  {
    emergency_key: 'typhoon', name: 'Typhoon', rule: 'Stay indoors', color: '#E6F4EA', border: '#B8E0C4',
    intro_title: 'What is a typhoon?',
    intro_lines: ['A typhoon is a very strong storm.', 'It brings heavy rain and wind.', 'We stay inside and wait for it to pass.'],
    signs: ['Dark clouds', 'Strong wind', 'The weather report warns of a typhoon'],
    puzzles: [
      { part_no: new Int32(1), type: 'order', title: 'Get ready', description: 'Put the steps in order' },
      { part_no: new Int32(2), type: 'safe_or_not', description: 'Is it safe?' },
      { part_no: new Int32(3), type: 'choose', description: 'What do we do?' },
      { part_no: new Int32(4), type: 'sort', description: 'Pack the go-bag' },
    ],
    end_summary: [
      { title: 'While it blows', text: 'Stay indoors, away from windows, until it passes.' },
      { title: 'Stay away from', text: 'Flooded streets, fallen wires, and loose roofing.' },
      { title: 'Be ready', text: 'Keep your go-bag and a flashlight nearby.' },
    ],
  },
  {
    emergency_key: 'flood', name: 'Flood', rule: 'Move to higher ground', color: '#E6F3FB', border: '#AFD8EE',
    intro_title: 'What is a flood?',
    intro_lines: ['A flood is when water covers land that is usually dry.', 'It can happen after heavy rain.', 'We move to higher ground and stay there.'],
    signs: ['Rising water', 'Heavy, long rain', 'A flood warning on the radio'],
    puzzles: [
      { part_no: new Int32(1), type: 'order', title: 'Move to higher ground', description: 'Put the steps in order' },
      { part_no: new Int32(2), type: 'safe_or_not', description: 'Is it safe?' },
      { part_no: new Int32(3), type: 'choose', description: 'What do we do?' },
      { part_no: new Int32(4), type: 'sort', description: 'Pack the go-bag' },
    ],
    end_summary: [
      { title: 'While it rises', text: 'Move to higher ground right away and stay there.' },
      { title: 'Never do this', text: 'Never walk or play in flood water, even if it looks shallow.' },
      { title: 'Stay informed', text: 'Listen for updates from a grown-up or the radio.' },
    ],
  },
  {
    emergency_key: 'tsunami', name: 'Tsunami', rule: 'Go inland and uphill', color: '#EAF0FB', border: '#C2CFEE',
    intro_title: 'What is a tsunami?',
    intro_lines: ['A tsunami is a very big wave from the sea.', 'It can come after a strong earthquake.', 'We go inland and uphill right away.'],
    signs: ['A strong earthquake near the coast', 'The sea pulls far back', 'A tsunami warning'],
    puzzles: [
      { part_no: new Int32(1), type: 'order', title: 'Go inland and uphill', description: 'Put the steps in order' },
      { part_no: new Int32(2), type: 'safe_or_not', description: 'Is it safe?' },
      { part_no: new Int32(3), type: 'choose', description: 'What do we do?' },
      { part_no: new Int32(4), type: 'sort', description: 'Pack the go-bag' },
    ],
    end_summary: [
      { title: 'Right away', text: 'If the ground shakes hard near the sea, go inland and uphill without waiting.' },
      { title: 'Never do this', text: 'Never go to the beach to watch, even if the water looks calm.' },
      { title: 'Stay away', text: 'Stay away from the coast until a grown-up says it is safe.' },
    ],
  },
  {
    emergency_key: 'volcano', name: 'Volcano', rule: 'Cover your nose and mouth', color: '#FBEFE6', border: '#EFC9A8',
    intro_title: 'What is a volcano eruption?',
    intro_lines: ['A volcano can send ash and smoke into the sky.', 'Ash can make it hard to breathe.', 'We cover our nose and mouth and go indoors.'],
    signs: ['Ash falling from the sky', 'A rumbling sound', 'A volcano warning'],
    puzzles: [
      { part_no: new Int32(1), type: 'order', title: 'Cover up and go indoors', description: 'Put the steps in order' },
      { part_no: new Int32(2), type: 'safe_or_not', description: 'Is it safe?' },
      { part_no: new Int32(3), type: 'choose', description: 'What do we do?' },
      { part_no: new Int32(4), type: 'sort', description: 'Pack the go-bag' },
    ],
    end_summary: [
      { title: 'While ash falls', text: 'Cover your nose and mouth with a cloth or mask, and go indoors.' },
      { title: 'Stay away from', text: 'Rivers near the volcano, which can flood with mud.' },
      { title: 'Be ready', text: 'Wear a mask or goggles if you must go outside.' },
    ],
  },
]

// ─── The 24 levels: 4 parts per emergency, in part_no order ─────────────────
function levelsFor(key, n) {
  const order = (shortName, tag, tagColor, question, ruleHint, steps) => ({
    level_order: new Int32(n), emergency_key: key, part_no: new Int32(1), mode: 'order',
    short_name: shortName, level_name: shortName, tag, tag_color: tagColor, question,
    rule_hint: ruleHint,
    items: steps.map(([label, text], i) => ({ step_order: new Int32(i + 1), label, text, image_url: img('scenes', `${key}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`) })),
  })
  const safe = (lead, cards) => ({
    level_order: new Int32(n + 1), emergency_key: key, part_no: new Int32(2), mode: 'safe_or_not',
    short_name: 'Is it safe?', level_name: 'Is it safe?', lead,
    items: cards.map(([label, isSafe, why]) => ({ label, image_url: img('scenes', `${key}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`), is_safe: isSafe, why })),
  })
  const choose = (question, choices) => ({
    level_order: new Int32(n + 2), emergency_key: key, part_no: new Int32(3), mode: 'choose',
    short_name: 'What do we do?', level_name: 'What do we do?',
    items: [{ question, choices: choices.map(([label, correct, why]) => ({ choice_key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, image_url: img('choices', `c-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`), is_correct: correct, why })) }],
  })
  const sort = (items) => ({
    level_order: new Int32(n + 3), emergency_key: key, part_no: new Int32(4), mode: 'sort',
    short_name: 'Pack the go-bag', level_name: 'Pack the go-bag',
    items: items.map(([label, zoneKey, why]) => ({ label, image_url: img('items', label.toLowerCase().replace(/[^a-z0-9]+/g, '-')), zone_key: zoneKey, why })),
  })
  return { order, safe, choose, sort }
}

const GO_BAG_COMMON = [
  ['Water', 'bag', 'Water keeps you hydrated when the taps may not work.'],
  ['Flashlight', 'bag', 'A flashlight helps you see if the power goes out.'],
  ['First aid kit', 'bag', 'A first aid kit treats small cuts and scrapes.'],
  ['Whistle', 'bag', 'A whistle helps rescuers find you.'],
  ['TV remote', 'home', 'You do not need this in the go-bag.'],
  ['Toy robot', 'home', 'Fun to have, but it stays at home this time.'],
]

const LEVELS = []
const builders = {
  earthquake: (b) => [
    b.order('Drop, Cover, Hold On', 'The ground is shaking!', 'amber', 'What do we do? Put the steps in order.', 'First we drop, then we cover, then we hold on.', [
      ['Drop', 'Drop down onto your hands and knees.'], ['Cover', 'Cover your head and neck with your arms.'], ['Hold on', 'Hold on until the shaking stops.'],
    ]),
    b.safe('During an earthquake…', [
      ['Use the elevator', false, 'Not safe. The elevator can stop working during an earthquake.'],
      ['Drop under a sturdy table', true, 'Yes! A sturdy table protects you from falling things.'],
      ['Run outside while it shakes', false, 'Not safe. You could be hit by falling glass or signs.'],
    ]),
    b.choose('What do we do first when the ground starts shaking?', [
      ['Drop', true, 'Yes! Drop first, then cover and hold on.'],
      ['Run outside', false, 'Not yet. Drop first, where you are.'],
      ['Call a friend', false, 'Not first. Keep yourself safe first.'],
    ]),
    b.sort([...GO_BAG_COMMON, ['Canned food', 'bag', 'Canned food does not spoil and needs no cooking.']]),
  ],
  fire: (b) => [
    b.order('Get low, get out', 'You smell smoke!', 'amber', 'What do we do? Put the steps in order.', null, [
      ['Shout', 'Shout "Fire!" so everyone hears you.'], ['Get low', 'Get low, under the smoke.'], ['Get out', 'Get out, and stay out.'],
    ]),
    b.safe('When there is a fire…', [
      ['Hide in a closet', false, 'Not safe. Hiding makes it harder for rescuers to find you.'],
      ['Crawl low under smoke', true, 'Yes! The air is cleaner near the floor.'],
      ['Stop to grab a toy', false, 'Not safe. Get out first, always.'],
    ]),
    b.choose('What number do we call for help?', [
      ['911', true, 'Yes! Call 911 once you are safely outside.'],
      ['123', false, 'That is not the emergency number.'],
      ['000', false, 'That is not the emergency number here.'],
    ]),
    b.sort([...GO_BAG_COMMON, ['Face mask', 'bag', 'A mask helps you breathe through smoke.']]),
  ],
  typhoon: (b) => [
    b.order('Get ready for the typhoon', 'A typhoon is coming!', 'amber', 'What do we do? Put the steps in order.', null, [
      ['Listen', 'Listen to the weather report with a grown-up.'], ['Pack', 'Pack the go-bag together.'], ['Stay in', 'Stay indoors until it passes.'],
    ]),
    b.safe('During a typhoon…', [
      ['Stay away from windows', true, 'Yes! Windows can break in strong wind.'],
      ['Play outside in the rain', false, 'Not safe. Strong wind can knock things over.'],
      ['Charge your flashlight', true, 'Yes! Good to be ready if the power goes out.'],
    ]),
    b.choose('Where is the safest place during a typhoon?', [
      ['Indoors', true, 'Yes! Stay indoors, away from windows.'],
      ['Under a tree', false, 'Not safe. Trees can fall in strong wind.'],
      ['By the window', false, 'Not safe. Stay away from windows.'],
    ]),
    b.sort([...GO_BAG_COMMON, ['Raincoat', 'bag', 'A raincoat keeps you dry.']]),
  ],
  flood: (b) => [
    b.order('Move to higher ground', 'The water is rising!', 'amber', 'What do we do? Put the steps in order.', null, [
      ['Notice', 'Notice the water rising around you.'], ['Move', 'Move to higher ground right away.'], ['Wait', 'Wait there until it is safe.'],
    ]),
    b.safe('During a flood…', [
      ['Walk through flood water', false, 'Not safe. Flood water can be deeper and stronger than it looks.'],
      ['Move to higher ground', true, 'Yes! Higher ground keeps you safe and dry.'],
      ['Listen to a grown-up', true, 'Yes! Grown-ups can help you find a safe way.'],
    ]),
    b.choose('What do we do when water starts rising?', [
      ['Move to higher ground', true, 'Yes! Move to higher ground right away.'],
      ['Keep playing', false, 'Not safe. Move to higher ground instead.'],
      ['Walk through it', false, 'Not safe. Flood water can be dangerous.'],
    ]),
    b.sort([...GO_BAG_COMMON, ['Boots', 'bag', 'Boots keep your feet dry and protected.']]),
  ],
  tsunami: (b) => [
    b.order('Go inland and uphill', 'The ground shook near the sea!', 'amber', 'What do we do? Put the steps in order.', null, [
      ['Feel', 'Feel a strong earthquake near the coast.'], ['Go', 'Go inland and uphill right away.'], ['Stay', 'Stay away from the coast until it is safe.'],
    ]),
    b.safe('Near the coast…', [
      ['Go to the beach to watch', false, 'Not safe. Go inland and uphill instead.'],
      ['Go inland and uphill', true, 'Yes! That keeps you safe from a tsunami.'],
      ['Wait for the water to pull back', false, 'Not safe. Go uphill as soon as the ground shakes.'],
    ]),
    b.choose('What do we do after a strong earthquake near the sea?', [
      ['Go inland and uphill', true, 'Yes! Go inland and uphill right away.'],
      ['Go to the beach', false, 'Not safe. Stay away from the coast.'],
      ['Wait and see', false, 'Not safe. Go uphill right away.'],
    ]),
    b.sort([...GO_BAG_COMMON, ['Medicine', 'bag', 'Bring any medicine you need every day.']]),
  ],
  volcano: (b) => [
    b.order('Cover up and go indoors', 'Ash is falling from the sky!', 'amber', 'What do we do? Put the steps in order.', null, [
      ['Cover', 'Cover your nose and mouth with a cloth.'], ['Go indoors', 'Go indoors, away from the ash.'], ['Close', 'Close the windows and doors.'],
    ]),
    b.safe('When ash is falling…', [
      ['Play outside', false, 'Not safe. Ash can make it hard to breathe.'],
      ['Cover your nose and mouth', true, 'Yes! A cloth or mask helps you breathe.'],
      ['Go indoors', true, 'Yes! Indoors is safer when ash is falling.'],
    ]),
    b.choose('What do we cover when ash is falling?', [
      ['Nose and mouth', true, 'Yes! That helps you breathe safely.'],
      ['Eyes only', false, 'Cover your nose and mouth too.'],
      ['Nothing', false, 'Always cover your nose and mouth in ash.'],
    ]),
    b.sort([...GO_BAG_COMMON, ['Face mask', 'bag', 'A mask helps you breathe through ash.']]),
  ],
}

let order = 1
for (const key of Object.keys(builders)) {
  const b = levelsFor(key, order)
  for (const level of builders[key](b)) LEVELS.push(level)
  order += 4
}

async function main() {
  await getMongo()
  const db = await getDb()
  const now = new Date()

  const admin = (await db.collection('users').findOne({ role: 'Super Admin' })) || (await db.collection('users').findOne({}))
  if (!admin) throw new Error('No user found to set as created_by.')

  let badgeId = null
  const existingBadge = await db.collection('badges').findOne({ code: 'safety_star' })
  if (!existingBadge) {
    const r = await db.collection('badges').insertOne({
      code: 'safety_star',
      name: 'Safety Star',
      description: 'Finished Emergency Ready.',
      emoji: '🌟',
      icon_url: null,
      theme_code: null,
      art: { shape: 'star', color: 'amber', symbol: 'star', banner: false },
      criteria: { type: 'complete_specific_game', game_id: null, value: new Int32(1) },
      unlock_item_type: null,
      unlock_item_code: null,
      is_active: true,
      sort_order: new Int32(92),
      created_by: admin._id,
      status: 'active',
      is_archived: false,
      is_deleted: false,
      earned_count: new Int32(0),
      created_at: now,
      updated_at: now,
    })
    badgeId = r.insertedId
    console.log('Created badge safety_star')
  } else {
    badgeId = existingBadge._id
  }

  const earthquakeReady = await db.collection('games').findOne({ name: 'Earthquake Ready' })
  const emergencyReady = await db.collection('games').findOne({ name: 'Emergency Ready' })

  let game
  if (emergencyReady) {
    await db.collection('games').updateOne({ _id: emergencyReady._id }, { $set: {
      type_settings: {
        step_by_step: { show_step_numbers: true, emergencies: EMERGENCIES },
        sort_place: { zones: [{ zone_key: 'bag', label: 'Go-bag' }, { zone_key: 'home', label: 'Leave at home' }] },
      },
      levels: LEVELS,
      updated_at: now,
    } })
    game = emergencyReady
    console.log('Emergency Ready already exists — levels replaced, status/badge link left as-is')
  } else if (earthquakeReady) {
    await db.collection('games').updateOne({ _id: earthquakeReady._id }, { $set: {
      name: 'Emergency Ready',
      type_settings: {
        step_by_step: { show_step_numbers: true, emergencies: EMERGENCIES },
        sort_place: { zones: [{ zone_key: 'bag', label: 'Go-bag' }, { zone_key: 'home', label: 'Leave at home' }] },
      },
      levels: LEVELS,
      updated_at: now,
    } })
    game = earthquakeReady
    console.log('Renamed Earthquake Ready to Emergency Ready and replaced its levels')
  } else {
    const r = await db.collection('games').insertOne({
      name: 'Emergency Ready',
      description: 'Learn what to do for six emergencies: earthquake, fire, typhoon, flood, tsunami and volcano.',
      therapy_type: 'cognitive',
      difficulty: 'hard',
      game_type: 'step_by_step',
      age_range: { min: new Int32(12), max: new Int32(19) },
      points_per_play: new Int32(150),
      unlocks_badge_id: badgeId,
      unlock_level: new Int32(3),
      stat_gains: statGains({ intelligence: 1, resistance: 1 }),
      therapist_note: 'Calm, no-timer safety practice for six emergencies. Stop if the patient seems anxious.',
      type_settings: {
        step_by_step: { show_step_numbers: true, emergencies: EMERGENCIES },
        sort_place: { zones: [{ zone_key: 'bag', label: 'Go-bag' }, { zone_key: 'home', label: 'Leave at home' }] },
      },
      levels: LEVELS,
      support: {
        target_size: 'extra_large', pace: 'no_timer', prompt_level: 'partial', read_aloud: true,
        picture_cues: true, simple_words: true, errorless_learning: true, fade_prompts: true,
        calm_visuals: true, reward_style: 'stars', session_minutes: new Int32(15),
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
    console.log('Inserted Emergency Ready as a draft')
  }

  await db.collection('badges').updateOne({ code: 'safety_star' }, { $set: { 'criteria.game_id': game._id } })
  await db.collection('games').updateOne({ _id: game._id }, { $set: { unlocks_badge_id: badgeId } })
  console.log('Linked the badge and the game.')
  console.log('Publish when ready: db.games.updateOne({ _id: ObjectId("' + game._id + '") }, { $set: { status: "published", published_at: new Date() } })')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
