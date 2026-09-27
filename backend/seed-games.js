// One-off dev script (run directly with `node`, same pattern as
// seed-owner-superadmin.js) that upserts the live Pao game hub's games (see
// GAMES in frontend/src/pages/GamifiedFullPage.jsx) into the `games`
// collection, so the catalog Super Admins manage in GamesLibraryPage
// actually reflects what patients play. Safe to re-run — matches on `name`
// and updates in place rather than duplicating.
//
// Usage:
//   node seed-games.js
require('dotenv').config();
const mongoose = require('mongoose');
const Game = require('./models/Game');
const User = require('./models/User');

const SEED_GAMES = [
  { name: 'Puzzle Pals', description: 'Place each piece where it belongs!', therapy_type: 'cognitive', difficulty: 'easy', game_type: 'sort_place', points_per_play: 100, therapist_note: 'Builds spatial awareness and positional vocabulary (on top, under, next to), strengthens visual matching and problem-solving, and supports fine motor coordination through drag-and-place actions.' },
  { name: 'Picture-Word Matching', description: 'Match a picture to the right word!', therapy_type: 'speech', difficulty: 'easy', game_type: 'picture_match', points_per_play: 100, therapist_note: 'Grows expressive and receptive vocabulary, reinforces picture-word association, and builds focus and quick decision-making with instant, encouraging feedback.' },
  { name: 'Slow-Motion Echo', description: 'Say each syllable, nice and slow!', therapy_type: 'speech', difficulty: 'easy', game_type: 'say_it', points_per_play: 100, therapist_note: 'Improves articulation and syllable segmentation, strengthens auditory discrimination, and builds speaking confidence at a self-paced, pressure-free speed — great for kids working through speech delays.' },
  { name: 'Sound Hunt', description: 'Find words with the same sound!', therapy_type: 'speech', difficulty: 'easy', game_type: 'choose_picture', points_per_play: 100, therapist_note: 'Sharpens phonological awareness by isolating beginning sounds, trains auditory discrimination, and lays an early-literacy foundation for reading.' },
  { name: 'Sentence Builder', description: 'Build sentences like a wizard!', therapy_type: 'cognitive', difficulty: 'medium', game_type: 'step_by_step', points_per_play: 100, therapist_note: 'Strengthens grammar and sentence structure, builds sequencing and working-memory skills, and supports expressive language development.' },
  { name: 'Rhyme Time', description: 'Find words that rhyme!', therapy_type: 'speech', difficulty: 'easy', game_type: 'choose_picture', points_per_play: 100, therapist_note: 'Builds phonological awareness through rhyme detection, strengthens auditory memory and pattern recognition, and supports pre-reading skills.' },
  { name: 'Story Builder', description: 'Create your own short story!', therapy_type: 'cognitive', difficulty: 'hard', game_type: 'step_by_step', points_per_play: 100, therapist_note: 'Builds narrative sequencing and comprehension, encourages decision-making and cause-and-effect reasoning, and supports social-emotional learning through story choices.' },
  { name: 'Alphabet Blast', description: 'Zoom through the alphabet!', therapy_type: 'speech', difficulty: 'medium', game_type: 'step_by_step', points_per_play: 100, therapist_note: 'Reinforces letter recognition and alphabet sequencing, builds processing speed, and strengthens an early-literacy foundation for reading and writing.' },
  { name: 'Sort the Basket', description: 'Sort each item into the right basket!', therapy_type: 'cognitive', difficulty: 'easy', game_type: 'sort_place', points_per_play: 100, therapist_note: 'Teaches categorisation — grouping things that belong together even when they look nothing alike — which underlies vocabulary growth, word retrieval, and everyday tasks like packing a bag. Uses errorless learning, so a wrong guess is never far off and confidence stays protected.' },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Create backend/.env (see server.js).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const superAdmin = await User.findOne({ role: 'Super Admin' });
  if (!superAdmin) {
    console.error('No Super Admin user found — run seed-owner-superadmin.js first.');
    process.exit(1);
  }

  for (const game of SEED_GAMES) {
    await Game.findOneAndUpdate(
      { name: game.name },
      {
        $set: { ...game, status: 'published', published_at: new Date(), updated_by: superAdmin._id },
        $setOnInsert: { created_by: superAdmin._id, test_played: true },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted game -> ${game.name}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
