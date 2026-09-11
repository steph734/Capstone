// Relaxes the `appointments` and `patients` validators so the patient booking
// page can write real rows even though the prototype has mock therapists and
// (sometimes) non-DB user accounts. Safe to re-run.
const mongoose = require('mongoose');
require('dotenv').config();

const appointments = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'session_date', 'start_time', 'end_time',
      'session_mode', 'status',
      'created_at', 'updated_at', 'is_archived',
    ],
    properties: {
      employee_id: { bsonType: ['objectId', 'null'], description: 'Assigned employee/therapist (null until employees are seeded).' },
      patient_id:  { bsonType: ['objectId', 'null'], description: 'The patient record.' },
      payment_id:  { bsonType: ['objectId', 'null'], description: 'Associated payment record.' },
      booked_by:   { bsonType: ['objectId', 'null'], description: 'User who booked (null for demo/non-DB accounts).' },

      patient_name:   { bsonType: ['string', 'null'], description: 'Denormalized patient full name.' },
      therapist_name: { bsonType: ['string', 'null'], description: 'Denormalized therapist name from the booking form.' },
      therapist_role: { bsonType: ['string', 'null'], description: 'Denormalized therapist role.' },
      guardian_name:  { bsonType: ['string', 'null'], description: 'Denormalized guardian full name.' },
      contact_number: { bsonType: ['string', 'null'], description: 'Contact number from the booking form.' },
      contact_email:  { bsonType: ['string', 'null'], description: 'Contact email from the booking form.' },

      session_date:    { bsonType: 'date', description: 'Date of the therapy session.' },
      start_time:      { bsonType: 'string', description: 'Start time, 24h "HH:MM".' },
      end_time:        { bsonType: 'string', description: 'End time, 24h "HH:MM".' },
      time_slot_label: { bsonType: ['string', 'null'], description: 'Original slot text, e.g. "8:00 - 9:00 AM".' },

      session_mode: {
        bsonType: 'string',
        enum: ['Face-to-Face', 'Online', 'In-Person'],
        description: 'Delivery mode. "In-Person" = the booking-form label for Face-to-Face.',
      },
      session_type: {
        bsonType: ['string', 'null'],
        enum: ['Cognitive', 'Speech', 'Behavioral', 'Occupational', 'Physical', 'Developmental', null],
        description: 'Therapy focus picked in the booking form.',
      },
      condition: { bsonType: ['string', 'null'], description: 'Child Condition chosen on the booking form.' },

      status: {
        bsonType: 'string',
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'],
        description: 'Current appointment status.',
      },
      cancelled_reason: { bsonType: ['string', 'null'], description: 'Reason when cancelled/rescheduled.' },

      session_fee:    { bsonType: ['double', 'int', 'null'], description: 'Per-session rate at booking time.' },
      service_charge: { bsonType: ['double', 'int', 'null'], description: 'Booking service charge.' },
      total_due:      { bsonType: ['double', 'int', 'null'], description: 'session_fee + service_charge.' },
      payment_method: {
        bsonType: ['string', 'null'],
        enum: ['Cash', 'Stripe', 'GCash QR', null],
        description: 'Payment method selected in booking step 3.',
      },

      created_at:  { bsonType: 'date', description: 'Record creation timestamp.' },
      updated_at:  { bsonType: 'date', description: 'Last updated timestamp.' },
      is_archived: { bsonType: 'bool', description: 'Soft delete flag.' },
      archived_at: { bsonType: ['date', 'null'], description: 'Date the appointment was archived.' },
    },
  },
};

const patients = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'first_name', 'last_name', 'birthdate', 'address',
      'gender', 'contact_number',
      'guardian_first_name', 'guardian_last_name', 'guardian_relationship',
      'created_at', 'updated_at',
    ],
    properties: {
      user_id:     { bsonType: ['objectId', 'null'], description: 'Associated User account (null when created from a booking).' },
      first_name:  { bsonType: 'string', description: "Patient's first name." },
      middle_name: { bsonType: ['string', 'null'], description: "Patient's middle name." },
      last_name:   { bsonType: 'string', description: "Patient's last name." },
      nickname:    { bsonType: ['string', 'null'], description: "Child's nickname (optional)." },
      gender:      { bsonType: 'string', enum: ['Male', 'Female', 'Other'], description: "Patient's gender." },
      birthdate:   { bsonType: 'date', description: "Patient's date of birth." },
      address:     { bsonType: 'string', description: "Patient's address." },
      contact_number: { bsonType: 'string', description: 'Patient/family contact number.' },
      email:       { bsonType: ['string', 'null'], description: 'Contact email entered on the booking form.' },
      guardian_first_name:     { bsonType: 'string', description: 'Parent/guardian first name.' },
      guardian_last_name:      { bsonType: 'string', description: 'Parent/guardian last name.' },
      guardian_relationship:   { bsonType: 'string', enum: ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Other'], description: 'Relationship of the contact person to the child.' },
      guardian_contact_number: { bsonType: ['string', 'null'], description: 'Guardian contact number.' },
      guardian_email:          { bsonType: ['string', 'null'], description: 'Guardian email address.' },
      created_at:  { bsonType: 'date', description: 'Record creation timestamp.' },
      updated_at:  { bsonType: 'date', description: 'Last updated timestamp.' },
    },
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  for (const [name, validator] of [['appointments', appointments], ['patients', patients]]) {
    const res = await db.command({
      collMod: name, validator, validationLevel: 'moderate', validationAction: 'error',
    });
    console.log(`collMod ${name} ->`, res.ok === 1 ? 'ok' : JSON.stringify(res));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
