// Makes sure EVERY game has a "finishes <game>" badge (criteria: complete_specific_game). Idempotent:
//   - a game that already has a badge for finishing it is left alone (its badge is only linked on the game if the link is empty);
//   - Daily Routines gets ONE badge (Routine Star); the five old per-task badges are retired (kept for history, no longer awarded);
//   - a badge with the same code is never overwritten.
//   - every badge also unlocks one Pao outfit piece (the `clothes` collection); the Clothes tab then shows "Finish <game>" on that item
//     automatically. An item already taken by another badge, or a badge that already unlocks something, is left alone.
//   node api/_lib/seeders/seedGameBadges.js          create what is missing
//   node api/_lib/seeders/seedGameBadges.js --dry    only print what would be created
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

const DRY = process.argv.includes('--dry')

// One badge per game, keyed by the game's name in the `games` collection.
// art: { shape, color, symbol } uses the same values as the badge builder (see src/data/badgeSymbols.js).
const BADGES = {
  'Puzzle Pals': { code: 'word_wizard', name: 'Word Wizard', description: 'Finished Puzzle Pals.', art: { shape: 'flower', color: 'gold', symbol: 'puzzle' } },
  'Slow-Motion Echo': { code: 'echo_expert', name: 'Echo Expert', description: 'Finished Slow-Motion Echo.', art: { shape: 'hexagon', color: 'teal', symbol: 'echo' } },
  'Sound Hunt': { code: 'sound_hunter', name: 'Sound Hunter', description: 'Finished Sound Hunt.', art: { shape: 'circle', color: 'green', symbol: 'magnifier' } },
  'Sentence Builder': { code: 'sentence_star', name: 'Sentence Star', description: 'Finished Sentence Builder.', art: { shape: 'star', color: 'indigo', symbol: 'blocks' } },
  'Rhyme Time': { code: 'rhyme_master', name: 'Rhyme Master', description: 'Finished Rhyme Time.', art: { shape: 'star', color: 'pink', symbol: 'rhyme' } },
  'Spot the Difference': { code: 'eagle_eyes', name: 'Eagle Eyes', description: 'Finished Spot the Difference.', art: { shape: 'shield', color: 'amber', symbol: 'magnifier' } },
  'Copy the Colors': { code: 'memory_master', name: 'Memory Master', description: 'Finished Copy the Colors.', art: { shape: 'scallop', color: 'blue', symbol: 'cards' } },
  'Story Builder': { code: 'story_teller', name: 'Story Teller', description: 'Finished Story Builder.', art: { shape: 'scallop', color: 'purple', symbol: 'scroll' } },
  'Alphabet Blast': { code: 'alphabet_blast', name: 'Alphabet Blast', description: 'Finished Alphabet Blast.', art: { shape: 'octagon', color: 'red', symbol: 'abc' } },
  'Emergency Ready': { code: 'safety_star', name: 'Safety Star', description: 'Finished Emergency Ready.', art: { shape: 'star', color: 'amber', symbol: 'star' } },
  'Feed Pao': { code: 'good_listener', name: 'Good Listener', description: 'Finished Feed Pao.', art: { shape: 'circle', color: 'green', symbol: 'soundwave' } },
  'Money Match': { code: 'money_match', name: 'Money Match', description: 'Finished Money Match.', art: { shape: 'circle', color: 'gold', symbol: 'balance' } },
  'Sort the Basket': { code: 'basket_boss', name: 'Basket Boss', description: 'Finished Sort the Basket.', art: { shape: 'rounded', color: 'orange', symbol: 'basket' } },
  'Daily Routines': { code: 'routine_star', name: 'Routine Star', description: 'Finished a Daily Routines task.', art: { shape: 'scallop', color: 'green', symbol: 'stretch' } },
  'Picture-Word Matching': { code: 'word_picture', name: 'Word Picture', description: 'Finished Picture-Word Matching.', art: { shape: 'gear', color: 'gold', symbol: 'picture' } },
}
// Which outfit piece (clothes.code) each game's badge unlocks.
const ITEMS = {
  'Puzzle Pals': 'wizard_hat', 'Rhyme Time': 'polka_dots', 'Money Match': 'astronaut',
  'Slow-Motion Echo': 'echo_scarf', 'Sound Hunt': 'thinking_cap', 'Sentence Builder': 'rainbow_tee', 'Spot the Difference': 'backwards_cap',
  'Copy the Colors': 'puzzle_vest', 'Story Builder': 'flower_crown', 'Alphabet Blast': 'rockets', 'Emergency Ready': 'hero_tee',
  'Feed Pao': 'cozy_hoodie', 'Daily Routines': 'pajamas', 'Sort the Basket': 'overalls', 'Picture-Word Matching': 'party_hat',
}
const SKIP = new Set()
const OLD_DAILY_BADGES = ['early_bird', 'clean_hands', 'little_chef', 'snack_maker', 'sweet_dreams']

async function main() {
  await getMongo()
  const db = await getDb()
  const now = new Date()
  const admin = (await db.collection('users').findOne({ role: 'Super Admin' })) || (await db.collection('users').findOne({}))
  if (!admin) throw new Error('No user found to set as created_by.')

  const games = await db.collection('games').find({}).project({ name: 1, unlocks_badge_id: 1 }).toArray()
  // outfit pieces that exist, and which are already unlocked by some badge
  const clothes = new Set((await db.collection('clothes').find({}).project({ code: 1 }).toArray()).map((c) => c.code))
  const taken = new Set((await db.collection('badges').find({ unlock_item_code: { $ne: null } }).project({ unlock_item_code: 1 }).toArray()).map((b) => b.unlock_item_code))
    let created = 0
  let linked = 0
  let order = 100

  for (const game of games) {
    if (SKIP.has(game.name)) { console.log(`- ${game.name}: has per-task badges, skipped`); continue }
    const spec = BADGES[game.name]
    const want = ITEMS[game.name]
    const itemFree = () => Boolean(want) && clothes.has(want) && !taken.has(want)
    if (!spec) { console.log(`! ${game.name}: no badge defined in this seeder (add one to BADGES)`); continue }

    // Already has a "finishes this game" badge? (any code)
    let badge = await db.collection('badges').findOne({ 'criteria.type': 'complete_specific_game', 'criteria.game_id': game._id, 'criteria.task_key': { $exists: false } })
    if (badge) {
      console.log(`= ${game.name}: already has "${badge.name}"`)
    } else {
      const byCode = await db.collection('badges').findOne({ code: spec.code })
      if (byCode) {
        console.log(`= ${game.name}: code "${spec.code}" already exists (not changed) - open it in the badge library to point it at this game`)
        badge = byCode
      } else {
        const doc = {
          code: spec.code,
          name: spec.name,
          description: spec.description,
          emoji: null,
          icon_url: null,
          theme_code: null,
          art: { ...spec.art, banner: false },
          criteria: { type: 'complete_specific_game', game_id: game._id, value: new Int32(1) },
          unlock_item_type: itemFree(spec) ? 'item' : null,
          unlock_item_code: itemFree(spec) ? ITEMS[game.name] : null,
          is_active: true,
          sort_order: new Int32(order),
          created_by: admin._id,
          status: 'active',
          is_archived: false,
          is_deleted: false,
          earned_count: new Int32(0),
          created_at: now,
          updated_at: now,
        }
        order += 1
        if (itemFree()) taken.add(want)
        console.log(`+ ${game.name}: ${DRY ? 'would create' : 'created'} badge "${spec.name}" (${spec.code})`)
        if (!DRY) badge = { ...doc, _id: (await db.collection('badges').insertOne(doc)).insertedId }
        else badge = null
        created += 1
      }
    }

    // An existing badge that unlocks nothing yet gets this game's outfit piece.
    if (badge && !badge.unlock_item_code && itemFree() && !DRY) {
      await db.collection('badges').updateOne({ _id: badge._id }, { $set: { unlock_item_type: 'item', unlock_item_code: want, updated_at: now } })
      taken.add(want)
      console.log(`  -> "${badge.name}" now unlocks "${want}"`)
    } else if (!badge && itemFree()) {
      taken.add(want) // dry run or just created: reserve it
    }

    // Link the game to its badge (the start modal and rewards flow read this) when nothing is linked yet.
    if (badge && !game.unlocks_badge_id && !DRY) {
      await db.collection('games').updateOne({ _id: game._id }, { $set: { unlocks_badge_id: badge._id, updated_at: now } })
      linked += 1
    }
  }

  // Retire the old per-task Daily Routines badges so only Routine Star is awarded. Patients who already earned them keep them.
  const old = await db.collection('badges').find({ code: { $in: OLD_DAILY_BADGES }, is_archived: { $ne: true } }).project({ code: 1, name: 1 }).toArray()
  for (const o of old) console.log(`${DRY ? '~ would retire' : '~ retired'} old Daily Routines badge "${o.name}"`)
  if (old.length && !DRY) {
    await db.collection('badges').updateMany({ _id: { $in: old.map((o) => o._id) } }, { $set: { is_active: false, status: 'archived', is_archived: true, archived_at: now, updated_at: now } })
  }

  console.log(`\n${DRY ? 'Dry run: ' : ''}${created} badge(s) ${DRY ? 'to create' : 'created'}, ${linked} game(s) linked.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
