// One-time, idempotent, ADDITIVE migration for idle-logout. Run with --dry-run first.
//   node scripts/migrate-sessions.mjs --dry-run
//   node scripts/migrate-sessions.mjs
// 1. sessions indexes: { user_id: 1, revoked: 1 } and a TTL index on expires_at (expired sessions are removed by MongoDB)
// 2. sessions validator (moderate: only documents that are inserted or changed are checked; nothing existing is rewritten)
// Nothing is deleted or overwritten. Needs MONGO_URI (frontend/.env).
process.loadEnvFile?.(new URL('../.env', import.meta.url))
const { getDb } = await import('../api/_lib/mongo.js')
const dry = process.argv.includes('--dry-run')
const db = await getDb()
const say = (m) => console.log(dry ? `[dry-run] ${m}` : m)

const sessions = db.collection('sessions')
const have = new Set((await sessions.indexes().catch(() => [])).map((i) => i.name))
const idx = async (spec, opts) => {
  if (have.has(opts.name)) { say(`index ${opts.name} already exists`); return }
  say(`index ${opts.name}`)
  if (!dry) await sessions.createIndex(spec, opts)
}
await idx({ user_id: 1, revoked: 1 }, { name: 'user_id_1_revoked_1' })
await idx({ expires_at: 1 }, { name: 'expires_at_ttl', expireAfterSeconds: 0 })

const info = (await db.listCollections({ name: 'sessions' }).toArray())[0]
if (info?.options?.validator?.$jsonSchema) say('sessions validator already present')
else {
  say('sessions validator (moderate)')
  if (!dry) {
    await db.command({
      collMod: 'sessions', validationLevel: 'moderate', validationAction: 'error',
      validator: { $jsonSchema: { bsonType: 'object', required: ['user_id', 'created_at', 'last_seen', 'expires_at', 'revoked'], properties: {
        user_id: { bsonType: 'objectId' }, created_at: { bsonType: 'date' }, last_seen: { bsonType: 'date' }, expires_at: { bsonType: 'date' },
        revoked: { bsonType: 'bool' }, revoked_at: { bsonType: 'date' }, revoked_reason: { enum: ['manual', 'idle', 'admin', 'expired'] },
        user_agent: { bsonType: 'string' }, ip: { bsonType: 'string' },
      } } },
    })
  }
}
console.log(dry ? 'Dry run finished. Nothing was written.' : 'Migration finished.')
process.exit(0)
