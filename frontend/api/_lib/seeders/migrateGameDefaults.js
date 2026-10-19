// Gives every game a numeric `default_minutes` and a `difficulty` ('easy'|'medium'|'hard') when missing.
// Safe to re-run: it only fills gaps.   node api/_lib/seeders/migrateGameDefaults.js
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()

const MINUTES_BY_TYPE = { choose_picture: 6, step_by_step: 10, sequence: 8, match: 8 }
const MINUTES_BY_DIFFICULTY = { easy: 5, medium: 8, hard: 10 }

async function main() {
  await getMongo()
  const db = await getDb()
  const games = await db.collection('games').find({}).toArray()
  let changed = 0
  for (const g of games) {
    const set = {}
    if (!['easy', 'medium', 'hard'].includes(g.difficulty)) set.difficulty = 'easy'
    const m = Math.round(Number(g.default_minutes))
    if (!Number.isFinite(m) || m < 1) {
      const diff = set.difficulty || g.difficulty
      set.default_minutes = new Int32(MINUTES_BY_TYPE[g.game_type] || MINUTES_BY_DIFFICULTY[diff] || 6)
    }
    if (Object.keys(set).length) {
      await db.collection('games').updateOne({ _id: g._id }, { $set: set })
      changed += 1
      console.log(`${g.name}:`, set)
    }
  }
  console.log(`Done. ${changed} of ${games.length} games updated.`)
  process.exit(0)
}
main().catch((err) => { console.error(err); process.exit(1) })
