// One-off data fix: online payments (card / GCash / Maya) recorded as PHP 350.
//
// Why: the old booking flow saved the booking TOTAL (session fee 300 + service charge 50 = 350) as the payment amount,
// but the checkout only ever charged / asked for the session fee (300). The new flow (api/_lib/paymentAttempts.js)
// records the amount the server charged (300), so this only corrects rows written by the old flow.
// Cash payments at 350 are correct (the clinic collects the full total) and are NOT touched.
//
//   node api/_lib/seeders/fixOnlinePaymentAmounts.js          dry run (lists what would change)
//   node api/_lib/seeders/fixOnlinePaymentAmounts.js --apply  do it
//
// Safe to run again: corrected rows no longer match. Each corrected row keeps the old value in `amount_corrected_from`.
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()
const apply = process.argv.includes('--apply')

await getMongo()
const db = await getDb()
const filter = { payment_for: 'appointment', amount: 350, method: { $in: ['card', 'gcash', 'paymaya'] }, amount_corrected_from: { $exists: false } }
const rows = await db.collection('payments').find(filter).project({ payment_ref: 1, method: 1, appointment_id: 1 }).toArray()
console.log(`${rows.length} online payment(s) recorded as 350${apply ? '' : ' (dry run, pass --apply to correct them to 300)'}`)

if (apply && rows.length) {
  const now = new Date()
  const pay = await db.collection('payments').updateMany(filter, { $set: { amount: 300, amount_corrected_from: 350, updated_at: now } })
  const ids = rows.map((r) => r.appointment_id).filter(Boolean)
  const appt = await db.collection('appointments').updateMany({ _id: { $in: ids }, total_due: 350 }, { $set: { total_due: 300, updated_at: now } })
  console.log(`corrected ${pay.modifiedCount} payment(s) and ${appt.modifiedCount} appointment total(s)`)
}
process.exit(0)
