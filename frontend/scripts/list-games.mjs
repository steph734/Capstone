// Read-only: lists every game record (name, status, points, stat gains, badge) so rewards problems can be diagnosed.
//   node scripts/list-games.mjs
import { getMongo, getDb } from '../api/_lib/mongo.js'

process.loadEnvFile?.()
await getMongo()
const db = await getDb()
const games = await db.collection('games').find({}).project({ name: 1, status: 1, points_per_play: 1, stat_gains: 1, unlocks_badge_id: 1, game_type: 1, therapy_type: 1 }).toArray()
for (const g of games.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
  const gains = Object.entries(g.stat_gains || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}+${v}`).join(' ')
  console.log(`${String(g.name).padEnd(26)} status=${String(g.status).padEnd(10)} xp=${String(g.points_per_play ?? '-').padEnd(4)} badge=${g.unlocks_badge_id ? 'yes' : 'no '} stats=${gains || '-'}`)
}
console.log(`\n${games.length} games`)
process.exit(0)
