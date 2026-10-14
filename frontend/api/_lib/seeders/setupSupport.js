// One-time setup for the support system (safe to re-run):
//   node api/_lib/seeders/setupSupport.js
// Needs MONGO_URI in frontend/.env. (The deployed API lives in frontend/api, so
// the scripts sit next to the other seeders here rather than in backend/.)
//  - the ticket_no counter ({_id:'ticket_no', seq:999} -> first ticket TCK-1000)
//  - faq_misses (TTL 180 days) and faq_feedback (one vote per user/FAQ/session)
//  - indexes for support_tickets, ticket_messages and faqs
//  - collMod: adds `source` and `context` to the support_tickets validator,
//    keeping every existing rule.
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()
await getMongo()
const db = await getDb()
const DAY = 86400

// 1. counter
await db.collection('counters').updateOne({ _id: 'ticket_no' }, { $setOnInsert: { seq: 999 } }, { upsert: true })
console.log('counter ticket_no ready')

// 2. helper collections
const existing = new Set((await db.listCollections().toArray()).map((c) => c.name))
for (const name of ['faq_misses', 'faq_feedback']) if (!existing.has(name)) await db.createCollection(name)
await db.collection('faq_misses').createIndex({ created_at: 1 }, { expireAfterSeconds: 180 * DAY, name: 'ttl_180d' })
await db.collection('faq_misses').createIndex({ text: 1 })
await db.collection('faq_feedback').createIndex({ faq_id: 1, user_id: 1, session_id: 1 }, { unique: true, name: 'one_vote_per_session' })
await db.collection('faq_feedback').createIndex({ created_at: 1 }, { expireAfterSeconds: 90 * DAY, name: 'ttl_90d' })
console.log('faq_misses (TTL 180 days) and faq_feedback ready')

// 3. indexes
const t = db.collection('support_tickets')
await t.createIndex({ ticket_no: 1 }, { unique: true, name: 'ticket_no_unique' })
await t.createIndex({ status: 1, priority: 1, last_message_at: -1 }, { name: 'status_priority_last' })
await t.createIndex({ requester_id: 1, ticket_created_at: -1 }, { name: 'requester_created' })
await t.createIndex({ unread_by_admin: 1, status: 1 }, { name: 'unread_status' })
await t.createIndex({ subject: 'text' }, { name: 'subject_text' })
await db.collection('ticket_messages').createIndex({ ticket_id: 1, message_created_at: 1 }, { name: 'ticket_thread' })
const f = db.collection('faqs')
await f.createIndex({ question: 'text', keywords: 'text', answer: 'text' }, { weights: { question: 10, keywords: 8, answer: 2 }, name: 'faq_text', default_language: 'english', language_override: 'text_lang' })
await f.createIndex({ roles: 1, is_active: 1, is_quick_question: 1 }, { name: 'roles_active_quick' })
console.log('indexes ready')

// 4. validator: add source + context (everything already there is kept)
const info = (await db.listCollections({ name: 'support_tickets' }).toArray())[0]
const schema = info.options.validator.$jsonSchema
schema.properties.source = { enum: ['faq_bot', 'help_page', 'auto'], description: 'Where the ticket was created.' }
schema.properties.context = {
  bsonType: 'object',
  description: 'Page and device details attached automatically.',
  properties: {
    page: { bsonType: 'string', maxLength: 200 }, browser: { bsonType: 'string', maxLength: 60 },
    os: { bsonType: 'string', maxLength: 60 }, app_version: { bsonType: 'string', maxLength: 30 },
  },
}
await db.command({ collMod: 'support_tickets', validator: { $jsonSchema: schema }, validationLevel: info.options.validationLevel || 'strict', validationAction: info.options.validationAction || 'error' })
console.log('support_tickets validator now allows source + context')
process.exit(0)
