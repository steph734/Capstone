// Adds the stopwatch fields (duration_seconds, used_seconds, run_started_at, pause_count ...) to existing session_game_plans,
// and widens the collection's $jsonSchema validator, if it has one, so the new fields are accepted.
//   node scripts/migrate-play-timer.mjs            report only
//   node scripts/migrate-play-timer.mjs --apply    write the changes
import { getMongo, getDb } from '../api/_lib/mongo.js'

process.loadEnvFile?.()
const APPLY = process.argv.includes('--apply')
await getMongo()
const db = await getDb()
const coll = db.collection('session_game_plans')

let patched = 0
for (const p of await coll.find({ duration_seconds: { $exists: false } }).toArray()) {
  const duration = Math.max(0, Math.round((p.play_end - p.play_start) / 1000))
  const ended = p.status === 'ended' || p.status === 'cancelled'
  const running = p.status === 'active'
  const set = {
    duration_seconds: duration,
    extended_seconds: Math.min(1800, (p.extended_minutes || 0) * 60),
    used_seconds: ended ? duration : 0,
    run_started_at: running ? (p.started_at || p.play_start) : null,
    pause_count: 0, total_paused_seconds: 0, started_early: false,
  }
  patched += 1
  if (APPLY) await coll.updateOne({ _id: p._id }, { $set: set })
}
console.log(`${APPLY ? 'Updated' : 'Would update'} ${patched} plan(s).`)

const info = (await db.listCollections({ name: 'session_game_plans' }).toArray())[0]
const schema = info?.options?.validator?.$jsonSchema
if (!schema) console.log('No $jsonSchema validator on session_game_plans: nothing to widen.')
else {
  const props = { ...(schema.properties || {}) }
  const add = {
    duration_seconds: { bsonType: ['int', 'long', 'double', 'null'] }, used_seconds: { bsonType: ['int', 'long', 'double'] },
    extended_seconds: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 1800 },
    run_started_at: { bsonType: ['date', 'null'] }, paused_at: { bsonType: ['date', 'null'] },
    pause_count: { bsonType: ['int', 'long', 'double'] }, total_paused_seconds: { bsonType: ['int', 'long', 'double'] },
    started_early: { bsonType: 'bool' },
  }
  const missing = Object.keys(add).filter((k) => !props[k])
  if (schema.additionalProperties === false || missing.length) {
    console.log(`Validator ${APPLY ? 'widened' : 'would be widened'}: ${missing.join(', ') || 'additionalProperties'}`)
    if (APPLY) await db.command({ collMod: 'session_game_plans', validator: { $jsonSchema: { ...schema, additionalProperties: undefined, properties: { ...props, ...add } } } })
  } else console.log('Validator already allows the new fields.')
}
process.exit(0)
