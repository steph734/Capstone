// Updates the `appointments` collection validator to cover the fields the
// frontend booking flow (frontend/src/pages/BookAppointmentPage.jsx) collects.
// Safe to re-run: collMod replaces the whole validator each time.
const mongoose = require('mongoose');
require('dotenv').config();

const appointmentsSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'employee_id', 'patient_id', 'booked_by',
      'session_date', 'start_time', 'end_time',
      'session_mode', 'status',
      'created_at', 'updated_at', 'is_archived',
    ],
    properties: {
      employee_id: { bsonType: 'objectId', description: 'References the assigned employee/therapist.' },
      patient_id:  { bsonType: 'objectId', description: 'References the patient.' },
      payment_id:  { bsonType: ['objectId', 'null'], description: 'References the associated payment record.' },
      booked_by:   { bsonType: 'objectId', description: 'References the user who booked the appointment.' },

      session_date:    { bsonType: 'date', description: 'Date of the therapy session.' },
      start_time:      { bsonType: 'string', description: 'Session start time, 24h "HH:MM" (parsed from the booking time slot).' },
      end_time:        { bsonType: 'string', description: 'Session end time, 24h "HH:MM" (parsed from the booking time slot).' },
      time_slot_label: { bsonType: ['string', 'null'], description: 'Original slot text shown in the UI, e.g. "8:00 - 9:00 AM".' },

      session_mode: {
        bsonType: 'string',
        enum: ['Face-to-Face', 'Online', 'In-Person'],
        description: 'Delivery mode. "In-Person" is the booking form label for Face-to-Face.',
      },
      session_type: {
        bsonType: ['string', 'null'],
        enum: ['Cognitive', 'Speech', 'Behavioral', 'Occupational', 'Physical', 'Developmental', null],
        description: 'Therapy focus picked in the booking form (separate axis from delivery mode).',
      },
      condition: {
        bsonType: ['string', 'null'],
        description: 'Child Condition chosen on the booking form (Speech Delay, ADHD, ...). Was only emailed before, now stored.',
      },

      status: {
        bsonType: 'string',
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'],
        description: 'Current appointment status.',
      },
      cancelled_reason: { bsonType: ['string', 'null'], description: 'Reason captured when cancelling or rescheduling.' },

      session_fee:    { bsonType: ['double', 'int', 'null'], description: 'Per-session rate at booking time (frontend SESSION_FEE, e.g. 300).' },
      service_charge: { bsonType: ['double', 'int', 'null'], description: 'Booking service charge (frontend SERVICE_CHARGE, e.g. 50).' },
      total_due:      { bsonType: ['double', 'int', 'null'], description: 'session_fee + service_charge (frontend TOTAL_DUE).' },
      payment_method: {
        bsonType: ['string', 'null'],
        enum: ['Cash', 'Stripe', null],
        description: 'Payment method selected in booking step 3.',
      },

      created_at:  { bsonType: 'date', description: 'Record creation timestamp.' },
      updated_at:  { bsonType: 'date', description: 'Last updated timestamp.' },
      is_archived: { bsonType: 'bool', description: 'Soft delete flag.' },
      archived_at: { bsonType: ['date', 'null'], description: 'Date the appointment was archived.' },
    },
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const res = await db.command({
    collMod: 'appointments',
    validator: appointmentsSchema,
    validationLevel: 'moderate',
    validationAction: 'error',
  });
  console.log('collMod appointments ->', JSON.stringify(res));
  const info = await db.listCollections({ name: 'appointments' }).toArray();
  console.log('\nStored properties now:',
    Object.keys(info[0].options.validator.$jsonSchema.properties).join(', '));
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
