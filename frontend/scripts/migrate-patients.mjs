// One-time, idempotent, ADDITIVE migration for the Therapist "My Patients" feature. Run with --dry-run first.
//   node scripts/migrate-patients.mjs --dry-run
//   node scripts/migrate-patients.mjs
// 1. patients.status = 'active' where missing, and patients.patient_code ('P-' + 6 chars) where missing
// 2. indexes: patients (status, last_name), unique partial patient_code; payments unique partial idempotency_key, (therapist_id, payment_for, status)
// 3. collMod on `payments`: allow payment_for 'first_session' and status 'awaiting_verification' (everything else in the validator is kept)
// Nothing is deleted or overwritten. Needs MONGO_URI (frontend/.env).
process.loadEnvFile?.(new URL('../.env', import.meta.url))
const { getDb } = await import('../api/_lib/mongo.js')
const dry = process.argv.includes('--dry-run')
const db = await getDb()
const say = (m) => console.log(dry ? `[dry-run] ${m}` : m)

// 1. backfill
const patients = db.collection('patients')
const noStatus = await patients.countDocuments({ status: { $exists: false } })
say(`patients without status: ${noStatus} -> set 'active'`)
if (!dry && noStatus) await patients.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } })

const noCode = await patients.find({ patient_code: { $exists: false } }, { projection: { _id: 1 } }).toArray()
say(`patients without patient_code: ${noCode.length}`)
if (noCode.length) {
  const taken = new Set((await patients.distinct('patient_code')).filter(Boolean))
  const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const rand = () => `P-${Array.from({ length: 6 }, () => CH[Math.floor(Math.random() * CH.length)]).join('')}`
  const ops = []
  for (const p of noCode) {
    let code = `P-${String(p._id).slice(-6).toUpperCase()}` // the code the old list already showed
    while (taken.has(code)) code = rand()
    taken.add(code)
    ops.push({ updateOne: { filter: { _id: p._id, patient_code: { $exists: false } }, update: { $set: { patient_code: code } } } })
  }
  if (!dry) await patients.bulkWrite(ops, { ordered: false })
}

// 2. indexes
const idx = async (col, key, opts) => { say(`index ${col} ${JSON.stringify(key)}`); if (!dry) await db.collection(col).createIndex(key, opts) }
await idx('patients', { status: 1, last_name: 1 }, { name: 'status_1_last_name_1' })
await idx('patients', { patient_code: 1 }, { name: 'patient_code_1_unique', unique: true, partialFilterExpression: { patient_code: { $type: 'string' } } })
await idx('payments', { idempotency_key: 1 }, { name: 'idempotency_key_1_unique', unique: true, partialFilterExpression: { idempotency_key: { $type: 'string' } } })
await idx('payments', { stripe_payment_intent_id: 1 }, { name: 'stripe_payment_intent_id_1_unique', unique: true, partialFilterExpression: { stripe_payment_intent_id: { $type: 'string' } } })
await idx('payments', { therapist_id: 1, payment_for: 1, status: 1 }, { name: 'therapist_id_1_payment_for_1_status_1' })

// 3. payments validator (only the two enums change)
const info = (await db.listCollections({ name: 'payments' }).toArray())[0]
const validator = info?.options?.validator
const props = validator?.$jsonSchema?.properties
if (props) {
  let changed = false
  const widen = (field, value) => { const e = props[field]?.enum; if (e && !e.includes(value)) { e.push(value); changed = true; say(`payments.${field}: add '${value}'`) } }
  widen('payment_for', 'first_session')
  widen('status', 'awaiting_verification')
  widen('method', 'card')
  if (changed && !dry) await db.command({ collMod: 'payments', validator, validationLevel: info.options.validationLevel || 'moderate' })
  if (!changed) say('payments validator already allows the new values')
} else say('payments has no $jsonSchema validator: nothing to change')
console.log(dry ? 'Dry run finished. Nothing was written.' : 'Migration finished.')
process.exit(0)
