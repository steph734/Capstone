// Idempotent setup for Sales / Billing (invoices + expenses).
//
//   node scripts/finance-setup.mjs                 DRY RUN: only prints what it would do (touches nothing)
//   node scripts/finance-setup.mjs --apply         creates `invoices` + `financial_audit_logs` if missing, builds indexes,
//                                                  upserts vendors, counters and the clinic_settings document
//   node scripts/finance-setup.mjs --apply --apply-collmod
//                                                  ALSO changes the live `payments` validator (see below)
//
// Safe to re-run: collections are created only if missing, indexes/seeds are no-ops when they already exist, and seed
// documents use $setOnInsert so edits you make later are never overwritten. The `expenses` and `vendors` collections
// (created in Compass) are never dropped or recreated. The connection string comes from MONGO_URI and is never printed.
import { MongoClient } from 'mongodb'
import { INVOICES_VALIDATOR, INDEXES, VENDOR_SEED, COUNTER_SEED, CLINIC_SEED, PAYMENTS_COLLMOD } from '../api/_lib/financeSchema.js'

export async function setup(db, { apply = false, applyCollMod = false, log = console.log } = {}) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name))
  const todo = (what) => log(`${apply ? '[apply]' : '[dry-run]'} ${what}`)

  for (const [name, validator] of [['invoices', INVOICES_VALIDATOR], ['financial_audit_logs', null]]) {
    if (existing.has(name)) { log(`ok: ${name} already exists`); continue }
    todo(`create collection ${name}${validator ? ' with validator' : ''}`)
    if (apply) await db.createCollection(name, validator ? { validator, validationLevel: 'strict', validationAction: 'error' } : {})
  }

  for (const [coll, specs] of Object.entries(INDEXES)) {
    if (!existing.has(coll) && !apply) { todo(`create indexes on ${coll} (after the collection is created)`); continue }
    for (const { key, options } of specs) {
      todo(`index ${coll}.${options.name}`)
      if (apply) await db.collection(coll).createIndex(key, options)
    }
  }

  for (const v of VENDOR_SEED) {
    todo(`upsert vendor "${v.vendor_name}"`)
    if (apply) await db.collection('vendors').updateOne({ vendor_name: v.vendor_name }, { $setOnInsert: { ...v } }, { upsert: true })
  }
  for (const [id, seq] of Object.entries(COUNTER_SEED)) {
    todo(`counter ${id} starts at ${seq} (only if missing)`)
    if (apply) await db.collection('counters').updateOne({ _id: id }, { $setOnInsert: { seq } }, { upsert: true })
  }
  todo('clinic_settings document (only if missing)')
  if (apply) await db.collection('clinic_settings').updateOne({ _id: 'clinic' }, { $setOnInsert: { ...CLINIC_SEED, created_at: new Date() } }, { upsert: true })

  // The only change to an existing collection. Needed so "Mark paid" can record an invoice payment.
  const info = (await db.listCollections({ name: 'payments' }).toArray())[0]
  const current = info?.options?.validator
  if (current?.$jsonSchema?.properties?.payment_for?.enum?.includes('invoice')) log('ok: payments already accepts payment_for = invoice')
  else if (current) {
    const cmd = PAYMENTS_COLLMOD(current)
    if (apply && applyCollMod) { log('[apply] collMod payments (adds payment_for = invoice and invoice_id)'); await db.command(cmd) }
    else {
      log('\nACTION NEEDED (not applied): `payments` does not yet accept invoice payments. Run this in mongosh / Compass shell, or re-run with --apply --apply-collmod:\n')
      log(`db.runCommand(${JSON.stringify(cmd, null, 2)})`)
    }
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:')}` || process.argv[1]?.endsWith('finance-setup.mjs')) {
  try { process.loadEnvFile?.('.env') } catch { /* env may come from the shell */ }
  const uri = process.env.MONGO_URI
  if (!uri) { console.error('MONGO_URI is not set (frontend/.env).'); process.exit(1) }
  const apply = process.argv.includes('--apply')
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
  try {
    await client.connect()
    const db = client.db()
    console.log(`Database: ${db.databaseName} | mode: ${apply ? 'APPLY' : 'DRY RUN (add --apply to write)'}\n`)
    await setup(db, { apply, applyCollMod: process.argv.includes('--apply-collmod') })
  } finally { await client.close() }
}
