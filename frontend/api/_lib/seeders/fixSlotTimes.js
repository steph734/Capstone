// One-time, re-runnable fix for appointment times saved with the wrong AM/PM.
//   node api/_lib/seeders/fixSlotTimes.js            (dry run: only lists what would change)
//   node api/_lib/seeders/fixSlotTimes.js --apply    (writes the fix)
//
// A slot labelled "11:00 - 12:00 PM" used to be saved with start_time "23:00" (the label's PM was applied to the start too),
// which showed as "11:00 PM" on the therapist's page and never matched the therapist's own 11:00 availability slot.
// This recomputes start_time / end_time from time_slot_label for every appointment where they disagree.
// It changes nothing else, and skips appointments that have no label.
import { getMongo, getDb } from '../mongo.js'
import { parseSlot } from '../bookingCore.js'

process.loadEnvFile?.()
const apply = process.argv.includes('--apply')
await getMongo()
const db = await getDb()

const rows = await db.collection('appointments').find({ time_slot_label: { $type: 'string', $ne: '' } }, { projection: { time_slot_label: 1, start_time: 1, end_time: 1, patient_name: 1, session_date: 1 } }).toArray()
let changed = 0
for (const a of rows) {
  const fixed = parseSlot(a.time_slot_label)
  if (fixed.start === '00:00' && fixed.end === '00:00') continue // label could not be read: leave it alone
  if (fixed.start === a.start_time && fixed.end === a.end_time) continue
  changed += 1
  console.log(`${apply ? 'fixing' : 'would fix'} ${a.patient_name || a._id} ${new Date(a.session_date).toISOString().slice(0, 10)} "${a.time_slot_label}": ${a.start_time}-${a.end_time} -> ${fixed.start}-${fixed.end}`)
  if (apply) await db.collection('appointments').updateOne({ _id: a._id }, { $set: { start_time: fixed.start, end_time: fixed.end } })
}
console.log(`${changed} appointment(s) ${apply ? 'fixed' : 'would change. Run again with --apply to write them.'}`)
process.exit(0)
