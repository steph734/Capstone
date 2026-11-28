// The patients collection still has a legacy UNIQUE index on PatientID. New patients no longer get a PatientID
// (their _id is the ID), so a second patient without one collided on { PatientID: null } (E11000) and online
// bookings failed with a 500. This rebuilds the index as PARTIAL: still unique, but only for documents that have one.
// Safe to re-run.   Run from the backend folder:  node fix-patientid-index.js
const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  const c = mongoose.connection.db.collection('patients');
  const idx = (await c.indexes()).find((i) => i.name === 'PatientID_1');
  if (idx && idx.partialFilterExpression) {
    console.log('already partial, nothing to do');
  } else {
    if (idx) { await c.dropIndex('PatientID_1'); console.log('dropped PatientID_1'); }
    await c.createIndex({ PatientID: 1 }, { name: 'PatientID_1', unique: true, partialFilterExpression: { PatientID: { $type: 'string' } } });
    console.log('created partial unique PatientID_1');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
