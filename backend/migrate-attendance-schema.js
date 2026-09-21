// The `attendance` collection was redesigned from "one document per
// employee per day" (employee+date, with time_in/time_out on the same doc)
// to "one document per scan event" (employee+scanned_at+type) — matching the
// $jsonSchema validator already live in Atlas. The old unique index on
// {employee, date} is now stale: every event document has no `date` field at
// all, so MongoDB treats that as `date: null` for all of them, and the
// *unique* index would then reject every scan after an employee's first one.
// This drops that old index and adds a non-unique one shaped for the new
// access pattern (an employee's scans, most recent first).
// Safe to re-run: dropIndex on a missing index just resolves quietly below,
// and createIndex is a no-op if the index already exists.
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const collection = db.collection('attendance');

  const indexes = await collection.indexes();
  const staleIndex = indexes.find((idx) => idx.name === 'employee_1_date_1');
  if (staleIndex) {
    await collection.dropIndex('employee_1_date_1');
    console.log('Dropped stale index: employee_1_date_1');
  } else {
    console.log('No stale employee_1_date_1 index found (already migrated).');
  }

  await collection.createIndex({ employee: 1, scanned_at: -1 });
  console.log('Ensured index: employee_1_scanned_at_-1');

  const after = await collection.indexes();
  console.log('\nIndexes now:', JSON.stringify(after.map((i) => i.name)));
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
