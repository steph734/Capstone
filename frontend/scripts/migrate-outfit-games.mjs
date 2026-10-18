// Stores each outfit's unlock game as a game id (clothes.unlock_game_id / pao_hair.unlock_game_id), adds the wardrobe indexes,
// and reports outfits that can't be matched to a game. The wardrobe search reads the same game live (own unlock rule, or the
// badge that unlocks the item), so this only keeps the stored id in step.
//   node scripts/migrate-outfit-games.mjs                 report only
//   node scripts/migrate-outfit-games.mjs --apply         write unlock_game_id + indexes
//   node scripts/migrate-outfit-games.mjs --apply --move-bowtie   also move "Orange Bowtie" from Hats to Clothes
import { getMongo, getDb } from '../api/_lib/mongo.js'

process.loadEnvFile?.()
const APPLY = process.argv.includes('--apply')
await getMongo()
const db = await getDb()

const games = await db.collection('games').find({}).project({ name: 1 }).toArray()
const gameById = new Map(games.map((g) => [String(g._id), g]))
const badges = await db.collection('badges').find({ is_active: true, is_archived: { $ne: true }, unlock_item_code: { $ne: null } }).toArray()
const badgeGame = new Map()
for (const b of badges) if (b.criteria?.type === 'complete_specific_game' && b.criteria.game_id) badgeGame.set(b.unlock_item_code, b.criteria.game_id)

let set = 0
const unmatched = []
for (const coll of ['clothes', 'pao_hair']) {
  for (const doc of await db.collection(coll).find({}).toArray()) {
    const id = (doc.unlock?.type === 'complete_specific_game' && doc.unlock.game_id) || badgeGame.get(doc.code) || null
    const game = id ? gameById.get(String(id)) : null
    if (id && !game) { unmatched.push(`${doc.name}: game id ${id} no longer exists`); continue }
    if (!game) { console.log(`  ${doc.name}: not linked to a game`); continue }
    console.log(`  ${doc.name} -> ${game.name}`)
    if (APPLY) { await db.collection(coll).updateOne({ _id: doc._id }, { $set: { unlock_game_id: game._id } }); set += 1 }
  }
}

if (APPLY) {
  await db.collection('clothes').createIndexes([{ key: { category: 1 } }, { key: { unlock_game_id: 1 } }, { key: { name: 1 } }])
  await db.collection('pao_hair').createIndexes([{ key: { unlock_game_id: 1 } }, { key: { name: 1 } }])
  console.log('indexes ensured')
}

const bow = await db.collection('clothes').findOne({ name: 'Orange Bowtie' })
if (bow) {
  console.log(`\nOrange Bowtie is in category "${bow.category}".`)
  if (bow.category !== 'clothes') {
    if (APPLY && process.argv.includes('--move-bowtie')) { await db.collection('clothes').updateOne({ _id: bow._id }, { $set: { category: 'clothes' } }); console.log('-> moved to clothes') }
    else console.log('-> run with --apply --move-bowtie to move it to Clothes (not done automatically).')
  }
}
if (unmatched.length) { console.log('\nCould not match a game:'); unmatched.forEach((u) => console.log('  ' + u)) }
console.log(`\n${APPLY ? `${set} outfit(s) updated.` : 'Report only (add --apply to write).'}`)
process.exit(0)
