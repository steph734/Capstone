// One-time, re-runnable fix for appointment times saved with the wrong AM/PM.
//   node api/_lib/seeders/fixSlotTimes.js            (dry run: only lists what would change)
//   node api/_lib/seeders/fixSlotTimes.js --apply    (writes the fix)
//
// A slot labelled "11:00 - 12:00 PM" used to be saved with start_time "23:00" (the label's PM was applied to the start too),
// which showed as "11:00 PM" on the therapist's page and never matched the therapist's own 11:00 availability slot.
// This recomputes start_time / end_time from time_slot_label for every appointment where they disagree.
// It also marks the therapist's availability slot as booked for every real, upcoming booking (that never happened for these, so the
// booking page kept offering a slot that was already taken). It changes nothing else, and skips appointments that have no label.
import { getMongo, getDb } from '../mongo.js'
import { parseSlot, markAvailability, NOT_A_REAL_BOOKING } from '../bookingCore.js'

process.loadEnvFile?.()
const apply = process.argv.includes('--apply')
await getMongo()
const db = await getDb()

const rows = await db.collection('appointments').find({ time_slot_label: { $type: 'string', $ne: '' } }, {}).toArray()
let changed = 0
let marked = 0
const today = new Date(Date.now() - 86400000)
for (const a of rows) {
  const fixed = parseSlot(a.time_slot_label)
  if (fixed.start === '00:00' && fixed.end === '00:00') continue // label could not be read: leave it alone
  const timesOk = fixed.start === a.start_time && fixed.end === a.end_time
  const real = ['Pending', 'Confirmed'].includes(a.status) && !a.is_archived && !NOT_A_REAL_BOOKING.includes(a.payment_state) && a.employee_id && new Date(a.session_date) >= today
  if (timesOk) {
    if (real && apply) { await markAvailability(db, a, true); marked += 1 }
    continue
  }
  changed += 1
  console.log(`${apply ? 'fixing' : 'would fix'} ${a.patient_name || a._id} ${new Date(a.session_date).toISOString().slice(0, 10)} "${a.time_slot_label}": ${a.start_time}-${a.end_time} -> ${fixed.start}-${fixed.end}`)
  if (apply) {
    await db.collection('appointments').updateOne({ _id: a._id }, { $set: { start_time: fixed.start, end_time: fixed.end } })
    if (real) { await markAvailability(db, { ...a, start_time: fixed.start, end_time: fixed.end }, true); marked += 1 }
  }
}
console.log(`${changed} appointment(s) ${apply ? 'fixed' : 'would change. Run again with --apply to write them.'}${apply ? `; ${marked} availability slot(s) marked booked` : ''}`)
process.exit(0)
