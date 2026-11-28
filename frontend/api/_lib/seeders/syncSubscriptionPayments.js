// Records Owner QR plan payments made BEFORE they were written to payment_attempts / payment_audit / payment_receipts /
// payments. Safe to run again: nothing is created twice.   Run from the frontend folder:
//   node api/_lib/seeders/syncSubscriptionPayments.js          dry run (lists the payments)
//   node api/_lib/seeders/syncSubscriptionPayments.js --apply  write the records
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { syncQrPayment } from '../subscriptionLedger.js'

process.loadEnvFile?.()
const apply = process.argv.includes('--apply')

await getMongo()
const db = await getDb()
const rows = await db.collection('subscription_qr_payments').find({}).sort({ submitted_at: 1 }).toArray()
console.log(`${rows.length} subscription QR payment(s)${apply ? '' : ' (dry run, pass --apply to record them)'}`)
for (const r of rows) {
  console.log(`  ${r.plan_key} PHP ${r.amount} ${r.method} ref ${r.reference_display} [${r.status}]`)
  if (apply) await syncQrPayment(db, r)
}
if (apply) console.log('Done.')
await mongoose.disconnect()
