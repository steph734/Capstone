// Per-branch TIN migration helper. DRY RUN by default: it only READS and prints. Nothing is written unless you pass a flag.
//
//   node scripts/branch-tin-migration.mjs
//        lists every branch without a TIN, shows the old clinic-level TIN setting, prints the commands below
//   node scripts/branch-tin-migration.mjs --apply-index
//        creates the unique partial index on branchs.tin (the TIN must be unique across branches)
//   node scripts/branch-tin-migration.mjs --apply-status-enum
//        collMod: adds 'Draft' and 'Declined' to branchs.status (the Branches page already uses both; without this
//        "Save as draft" and "Decline" are rejected by the collection validator). Nothing else in the validator changes.
//   node scripts/branch-tin-migration.mjs --assign-owner=<userId> --apply
//        sets owner_id on every branch that has none (so the Owner can see/edit their branches' invoice details)
//
// The old clinic-level TIN ("45665767", clinic_settings.business_tin) is NOT copied anywhere: it has 8 digits and does not
// match the branch pattern ^\d{3}-\d{3}-\d{3}-\d{3,5}$. Set each branch's real TIN from Branches -> Edit branch.
// The connection string comes from MONGO_URI and is never printed.
import { MongoClient, ObjectId } from 'mongodb'
import { TIN_RE } from '../api/_lib/branchBilling.js'

try { process.loadEnvFile?.('.env') } catch { /* env may come from the shell */ }
const uri = process.env.MONGO_URI
if (!uri) { console.error('MONGO_URI is not set (frontend/.env).'); process.exit(1) }
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const ownerArg = (args.find((a) => a.startsWith('--assign-owner=')) || '').split('=')[1]

export const INDEX_CMD = `db.branchs.createIndex({ tin: 1 }, { unique: true, name: 'uniq_branch_tin', partialFilterExpression: { tin: { $exists: true } } })`

export function statusEnumCollMod(currentValidator) {
  const v = JSON.parse(JSON.stringify(currentValidator))
  const en = v.$jsonSchema.properties.status.enum
  for (const s of ['Draft', 'Declined']) if (!en.includes(s)) en.push(s)
  return { collMod: 'branchs', validator: v, validationLevel: 'strict', validationAction: 'error' }
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
try {
  await client.connect()
  const db = client.db()
  console.log(`Database: ${db.databaseName}\n`)
  const branches = await db.collection('branchs').find({}, { projection: { branch_name: 1, status: 1, tin: 1, owner_id: 1 } }).sort({ branch_name: 1 }).toArray()
  const clinic = await db.collection('clinic_settings').findOne({ _id: 'clinic' }, { projection: { business_tin: 1 } })

  console.log('Old clinic-level TIN setting (clinic_settings.business_tin):', clinic?.business_tin ? `"${clinic.business_tin}"` : '(none)')
  if (clinic?.business_tin) console.log(`  matches the branch TIN pattern? ${TIN_RE.test(clinic.business_tin) ? 'yes' : 'NO, so it is not copied automatically'}\n`)

  const missing = branches.filter((b) => !b.tin)
  console.log(`Branches without a TIN (${missing.length} of ${branches.length}):`)
  for (const b of missing) console.log(`  - ${b.branch_name} [${b.status}] id=${b._id}${b.owner_id ? '' : '  (no owner_id)'}`)

  console.log('\n// Template per branch (commented out: replace the TIN, then run it in mongosh / Compass, or use Branches -> Edit branch):')
  for (const b of missing) console.log(`// db.branchs.updateOne({ _id: ObjectId("${b._id}") }, { $set: { tin: "000-000-000-00000" } })   // ${b.branch_name}`)

  const owners = await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { full_name: 1 } }).toArray()
  const noOwner = branches.filter((b) => !b.owner_id)
  if (noOwner.length) {
    console.log(`\n${noOwner.length} branch(es) have no owner_id, so no Owner can see their invoice details yet. Owner accounts:`)
    for (const o of owners) console.log(`  - ${o.full_name || '(no name)'} id=${o._id}`)
    console.log('Assign with:  node scripts/branch-tin-migration.mjs --assign-owner=<userId> --apply   (or set it per branch in Edit branch -> Owner)')
  }

  const info = (await db.listCollections({ name: 'branchs' }).toArray())[0]
  const statuses = info?.options?.validator?.$jsonSchema?.properties?.status?.enum || []
  const needEnum = ['Draft', 'Declined'].filter((s) => !statuses.includes(s))
  if (needEnum.length) {
    console.log(`\nACTION NEEDED: the status enum lacks ${needEnum.join(' and ')}. Run with --apply-status-enum, or this collMod in mongosh:\n`)
    console.log(`db.runCommand(${JSON.stringify(statusEnumCollMod(info.options.validator), null, 2)})`)
  } else console.log('\nok: the status enum already allows Draft and Declined')

  const hasIndex = (await db.collection('branchs').indexes()).some((i) => i.name === 'uniq_branch_tin' || (i.unique && i.key?.tin === 1))
  console.log(hasIndex ? '\nok: unique index on tin exists' : `\nACTION NEEDED: unique TIN index. Run with --apply-index, or in mongosh:\n${INDEX_CMD}`)

  if (flag('--apply-index') && !hasIndex) {
    await db.collection('branchs').createIndex({ tin: 1 }, { unique: true, name: 'uniq_branch_tin', partialFilterExpression: { tin: { $exists: true } } })
    console.log('[apply] created uniq_branch_tin')
  }
  if (flag('--apply-status-enum') && needEnum.length) {
    await db.command(statusEnumCollMod(info.options.validator))
    console.log('[apply] branchs.status enum now includes Draft and Declined')
  }
  if (ownerArg) {
    if (!ObjectId.isValid(ownerArg)) throw new Error('--assign-owner needs a valid user id')
    const u = await db.collection('users').findOne({ _id: new ObjectId(ownerArg), role: 'Owner' })
    if (!u) throw new Error('That user is not an Owner.')
    if (!flag('--apply')) console.log(`\n[dry-run] would set owner_id on ${noOwner.length} branch(es). Add --apply to do it.`)
    else {
      const r = await db.collection('branchs').updateMany({ owner_id: { $exists: false } }, { $set: { owner_id: u._id, updated_at: new Date() } })
      console.log(`[apply] owner_id set on ${r.modifiedCount} branch(es)`)
    }
  }
} finally { await client.close() }
