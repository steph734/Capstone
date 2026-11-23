// One-time, idempotent, ADDITIVE: indexes used by the Therapist Appointments page. Run with --dry-run first.
//   node scripts/migrate-appointments-page.mjs --dry-run
//   node scripts/migrate-appointments-page.mjs
// appointments: { employee_id, session_date, start_time }, { employee_id, status, is_archived }
// Nothing is deleted or rewritten. Needs MONGO_URI (frontend/.env).
process.loadEnvFile?.(new URL('../.env', import.meta.url))
const { getDb } = await import('../api/_lib/mongo.js')
const dry = process.argv.includes('--dry-run')
const db = await getDb()
const col = db.collection('appointments')
const have = new Set((await col.indexes()).map((i) => i.name))
for (const [spec, name] of [[{ employee_id: 1, session_date: 1, start_time: 1 }, 'employee_id_1_session_date_1_start_time_1'], [{ employee_id: 1, status: 1, is_archived: 1 }, 'employee_id_1_status_1_is_archived_1']]) {
  if (have.has(name)) { console.log(`index ${name} already exists`); continue }
  console.log(`${dry ? '[dry-run] ' : ''}index ${name}`)
  if (!dry) await col.createIndex(spec, { name })
}
console.log(dry ? 'Dry run finished. Nothing was written.' : 'Migration finished.')
process.exit(0)
