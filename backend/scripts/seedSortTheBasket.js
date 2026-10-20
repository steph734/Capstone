// Upserts the "Sort the Basket" game into the `games` collection (matched by
// name, so re-running never creates a duplicate). Writes through the native
// driver so integer fields are stored as int32, as the collection's
// $jsonSchema validator requires.
//
// Usage (from backend/):
//   node scripts/seedSortTheBasket.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const { Int32 } = mongoose.mongo;
const i32 = (n) => new Int32(n);

const IMG = '/games/sort-the-basket/items';
const TEXT = { food: 'We can eat it.', clothes: 'We can wear it.', toys: 'We can play with it.' };
const item = (zone, label, file) => ({ label, text: TEXT[zone], image_url: `${IMG}/${zone}/${file}.svg`, zone_key: zone });

const apple = item('food', 'Apple', 'apple');
const banana = item('food', 'Banana', 'banana');
const egg = item('food', 'Egg', 'egg');
const bread = item('food', 'Bread', 'bread');
const carrot = item('food', 'Carrot', 'carrot');
const shirt = item('clothes', 'Shirt', 'shirt');
const sock = item('clothes', 'Sock', 'sock');
const hat = item('clothes', 'Hat', 'hat');
const shoe = item('clothes', 'Shoe', 'shoe');
const teddy = item('toys', 'Teddy bear', 'teddy-bear');
const ball = item('toys', 'Ball', 'ball');
const car = item('toys', 'Toy car', 'toy-car');
const blocks = item('toys', 'Blocks', 'blocks');

const LEVELS = [
  { level_order: i32(1), level_name: 'Warm-up', prompt_level: 'full_model', items: [apple, shirt, teddy] },
  { level_order: i32(2), level_name: 'Getting Better', prompt_level: 'partial', items: [banana, sock, ball, egg, hat, car] },
  { level_order: i32(3), level_name: 'Sorting Star', prompt_level: 'none', items: [bread, shoe, blocks, carrot, apple, shirt, teddy, egg, ball] },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const games = db.collection('games');
  const now = new Date();

  const admin = await db.collection('users').findOne({ role: 'Super Admin' });
  if (!admin) throw new Error('No Super Admin user found to set as created_by.');

  const fields = {
    name: 'Sort the Basket',
    description: 'Look at the picture and put it in the right basket: Food, Clothes, or Toys.',
    therapy_type: 'cognitive',
    difficulty: 'easy',
    game_type: 'sort_place',
    age_range: { min: i32(3), max: i32(10) },
    points_per_play: i32(10),
    unlocks_badge_id: null,
    therapist_note: "Say the item name and its use ('We can eat it'). Level 1 shows the answer, Level 2 gives a hint, Level 3 has no hints. Praise every try.",
    type_settings: {
      sort_place: {
        snap_help: 'strong',
        show_target_outlines: true,
        zones: [
          { zone_key: 'food', label: 'Food basket', color: '#E98A2B' },
          { zone_key: 'clothes', label: 'Clothes basket', color: '#3D7FD0' },
          { zone_key: 'toys', label: 'Toys basket', color: '#B65AB0' },
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
      session_minutes: i32(10),
    },
    status: 'published',
    test_played: true,
    source_request_id: null,
    updated_by: admin._id,
    updated_at: now,
    published_at: now,
  };

  // Keep the original badge link / catalogue fields if the game already exists.
  const existing = await games.findOne({ name: fields.name });
  if (existing) delete fields.unlocks_badge_id;

  const r = await games.updateOne(
    { name: fields.name },
    { $set: fields, $setOnInsert: { created_by: admin._id, created_at: now } },
    { upsert: true },
  );
  console.log(r.upsertedCount ? 'Inserted' : 'Updated', 'Sort the Basket');

  const count = await games.countDocuments({ name: fields.name });
  console.log('Documents named "Sort the Basket":', count);

  // Prove the stored document satisfies the collection validator: re-insert a
  // copy under a throwaway name and delete it again.
  const { _id, ...copy } = await games.findOne({ name: fields.name });
  copy.name = 'Sort the Basket (validation check)';
  try {
    const t = await games.insertOne(copy);
    await games.deleteOne({ _id: t.insertedId });
    console.log('Validation: document passes the games $jsonSchema.');
  } catch (e) {
    console.error('Validation FAILED:', JSON.stringify(e.errInfo?.details || e.message, null, 2));
    process.exitCode = 1;
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
