// One-time, re-runnable migration for the Super Admin ticket desk:
//   node api/_lib/seeders/migrateTicketDesk.js
// Needs MONGO_URI in frontend/.env. It never deletes or rewrites existing data:
//  - collMod: adds resolution_code, resolution_notes, resolution_draft and resolved_by to the
//    support_tickets validator (every existing rule is kept),
//  - backfills those fields on existing tickets with empty defaults (unassigned stays null),
//  - indexes for the ticket_activity log and the new list sorts.
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()
await getMongo()
const db = await getDb()

const info = (await db.listCollections({ name: 'support_tickets' }).toArray())[0]
const schema = info?.options?.validator?.$jsonSchema
if (schema) {
  schema.properties = {
    ...schema.properties,
    resolution_code: { bsonType: ['string', 'null'], description: 'Why the ticket was resolved.' },
    resolution_notes: { bsonType: ['string', 'null'], maxLength: 5000, description: 'Shown to the requester when resolved.' },
    resolution_draft: { bsonType: ['string', 'null'], maxLength: 5000, description: 'Draft of the resolution notes, not shown to the requester.' },
    resolved_by: { bsonType: ['objectId', 'null'] },
  }
  await db.command({ collMod: 'support_tickets', validator: { $jsonSchema: schema }, validationLevel: info.options.validationLevel || 'strict', validationAction: info.options.validationAction || 'error' })
  console.log('support_tickets validator now allows the resolution fields')
} else {
  console.log('support_tickets has no validator; nothing to change there')
}

const t = db.collection('support_tickets')
const r = await t.updateMany({ resolution_code: { $exists: false } }, { $set: { resolution_code: null, resolution_notes: null, resolution_draft: '', resolved_by: null } })
console.log(`backfilled ${r.modifiedCount} tickets`)
const a = await t.updateMany({ assigned_to: { $exists: false } }, { $set: { assigned_to: null } })
console.log(`defaulted assigned_to on ${a.modifiedCount} tickets`)

await db.collection('ticket_activity').createIndex({ ticket_id: 1, created_at: 1 }, { name: 'ticket_activity_thread' })
await t.createIndex({ ticket_created_at: 1 }, { name: 'created_asc' })
await t.createIndex({ ticket_updated_at: -1 }, { name: 'updated_desc' })
console.log('indexes ready')
process.exit(0)
