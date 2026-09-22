// The `therapist_availability` collection was redesigned:
//   - `employee` (ObjectId) renamed to `therapist`, plus new denormalized
//     therapist_name/branch_id/branch_name, a `timezone`, and a link to the
//     time-in `attendance` record that prompted the answer.
//   - `slots` went from a flat array of display-label strings (e.g.
//     "8:00 - 9:00 AM") to an array of { start, end, status, appointment }
//     objects (24-hour 'HH:mm', PH time) so a slot's booked/blocked state can
//     be tracked per slot.
//   - top-level `status` ('confirmed' | 'skipped') and `confirmed_at` added,
//     plus is_archived/archived_at for the soft-delete convention used
//     elsewhere in this database.
// This migrates any documents still in the old shape to match the
// $jsonSchema validator now live in Atlas. Safe to re-run — it only touches
// documents that still have an `employee` field.
const mongoose = require('mongoose');
require('dotenv').config();

const LABEL_TO_TIME = {
  '8:00 - 9:00 AM': { start: '08:00', end: '09:00' },
  '9:00 - 10:00 AM': { start: '09:00', end: '10:00' },
  '10:00 - 11:00 AM': { start: '10:00', end: '11:00' },
  '11:00 - 12:00 PM': { start: '11:00', end: '12:00' },
  '1:00 - 2:00 PM': { start: '13:00', end: '14:00' },
  '2:00 - 3:00 PM': { start: '14:00', end: '15:00' },
  '3:00 - 4:00 PM': { start: '15:00', end: '16:00' },
  '4:00 - 5:00 PM': { start: '16:00', end: '17:00' },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const collection = db.collection('therapist_availability');

  const legacyDocs = await collection.find({ employee: { $exists: true } }).toArray();
  console.log(`Found ${legacyDocs.length} legacy-shaped document(s) to migrate.`);

  for (const doc of legacyDocs) {
    const oldSlots = Array.isArray(doc.slots) ? doc.slots : [];
    const newSlots = oldSlots
      .map((label) => (typeof label === 'string' ? LABEL_TO_TIME[label] : null))
      .filter(Boolean)
      .map(({ start, end }) => ({ start, end, status: 'available', appointment: null }));

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          therapist: doc.employee,
          timezone: doc.timezone || 'Asia/Manila',
          slots: newSlots,
          status: doc.status === 'confirmed' || doc.status === 'skipped'
            ? doc.status
            : (newSlots.length ? 'confirmed' : 'skipped'),
          confirmed_at: doc.confirmed_at || (newSlots.length ? (doc.updated_at || new Date()) : null),
          is_archived: typeof doc.is_archived === 'boolean' ? doc.is_archived : false,
        },
        $unset: { employee: '' },
      }
    );
    console.log(`Migrated ${doc._id} (${oldSlots.length} old slot label(s) -> ${newSlots.length} new slot object(s))`);
  }

  const indexes = await collection.indexes();
  const staleIndex = indexes.find((idx) => idx.name === 'employee_1_date_1');
  if (staleIndex) {
    await collection.dropIndex('employee_1_date_1');
    console.log('Dropped stale index: employee_1_date_1');
  } else {
    console.log('No stale employee_1_date_1 index found (already migrated).');
  }

  await collection.createIndex({ therapist: 1, date: 1 }, { unique: true });
  console.log('Ensured unique index: therapist_1_date_1');

  const after = await collection.indexes();
  console.log('\nIndexes now:', JSON.stringify(after.map((i) => i.name)));
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
