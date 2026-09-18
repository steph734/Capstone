// Adds 'for_review' to the `employees` collection's `status` enum so a newly
// added hire (pending owner approval — see `approved_at`) can carry a real
// status value instead of always showing 'active' before they're approved.
// Safe to re-run: collMod replaces the whole validator each time. Schema
// otherwise mirrors the validator already live in Atlas (see backend/models/Employee.js).
const mongoose = require('mongoose');
require('dotenv').config();

const employeesSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['user_id', 'branch_id', 'first_name', 'middle_name', 'last_name', 'employee_id'],
    properties: {
      user_id: { bsonType: 'objectId', description: 'References the associated User account.' },
      branch_id: { bsonType: 'objectId', description: 'References the Branch.' },
      first_name: { bsonType: 'string', description: "Employee's first name." },
      middle_name: { bsonType: 'string', description: "Employee's middle name." },
      last_name: { bsonType: 'string', description: "Employee's last name." },
      email: { bsonType: 'string', pattern: '^.+@.+\\..+$', description: "Employee's email address." },
      phone: {
        bsonType: 'object',
        required: ['country_code', 'number'],
        properties: {
          country_code: { bsonType: 'string', description: 'Phone country code, e.g. "+63".' },
          number: { bsonType: 'string', description: 'Phone number without country code.' },
        },
        description: "Employee's contact number with country code.",
      },
      dob: { bsonType: 'date', description: "Employee's date of birth." },
      gender: {
        bsonType: 'string',
        enum: ['male', 'female', 'other', 'prefer_not_to_say'],
        description: "Employee's gender.",
      },
      address: { bsonType: 'string', description: "Employee's residential address." },
      emergency_contact: { bsonType: 'string', description: 'Name of emergency contact person.' },
      emergency_phone: { bsonType: 'string', description: 'Phone number of emergency contact.' },
      profile_picture: {
        bsonType: 'object',
        properties: {
          url: { bsonType: 'string', description: "File path/URL to the employee's profile photo." },
          storage_key: {
            bsonType: 'string',
            description: 'Storage bucket key/path used to reference or delete the file (e.g. S3 key, Cloudinary public_id).',
          },
          uploaded_at: { bsonType: 'date', description: 'Timestamp when the profile photo was uploaded.' },
        },
        description: "Employee's profile picture metadata, uploaded during staff onboarding.",
      },
      specialty: {
        bsonType: 'string',
        description: "Employee's medical/clinical specialty (e.g. Therapy Specialty from the Add Staff form).",
      },
      employee_id: {
        bsonType: 'string',
        description: 'Internal employee ID / staff number, e.g. "EMP-0010" (distinct from user_id).',
      },
      prc_number: { bsonType: 'string', description: 'PRC license number.' },
      experience: { bsonType: ['int', 'double'], minimum: 0, description: 'Years of professional experience.' },
      employment_type: {
        bsonType: 'string',
        enum: ['Full-time', 'Part-time', 'Contract', 'Locum'],
        description: 'Type of employment.',
      },
      license_expiry: { bsonType: 'date', description: 'Expiry date of professional license.' },
      status: {
        bsonType: 'string',
        // 'for_review' added: a hire sits here from creation until the owner
        // approves them (approved_at), at which point the backend flips this
        // to 'active'.
        enum: ['for_review', 'active', 'inactive', 'on_leave', 'terminated'],
        description: 'Current employment status.',
      },
      documents: {
        bsonType: 'object',
        properties: {
          ptr: { bsonType: 'string', description: 'File path/URL to PTR document.' },
          prc: { bsonType: 'string', description: 'File path/URL to PRC document.' },
          diploma: { bsonType: 'string', description: 'File path/URL to diploma document.' },
          id: { bsonType: 'string', description: 'File path/URL to government-issued ID.' },
        },
        description: 'Uploaded document references for compliance/verification.',
      },
    },
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const res = await db.command({
    collMod: 'employees',
    validator: employeesSchema,
    validationLevel: 'strict',
    validationAction: 'error',
  });
  console.log('collMod employees ->', JSON.stringify(res));
  const info = await db.listCollections({ name: 'employees' }).toArray();
  console.log('\nstatus enum now:', info[0].options.validator.$jsonSchema.properties.status.enum.join(', '));
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
