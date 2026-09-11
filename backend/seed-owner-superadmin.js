// One-off dev script (run directly with `node`, same pattern as the other
// seed-*.js / migrate-*.js scripts in this folder) that upserts the two
// fixed accounts below into the `users` collection so they're always
// available for local login testing. Safe to re-run — it updates the
// password hash in place instead of erroring on the unique email/username
// indexes.
//
// Usage:
//   node seed-owner-superadmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const SEED_USERS = [
  {
    username: 'owner',
    email: 'owner@gmail.com',
    password: 'owner123',
    full_name: 'Owner',
    role: 'Owner',
  },
  {
    username: 'superadmin',
    email: 'superadmin@gmail.com',
    password: 'superadmin123',
    full_name: 'Super Admin',
    role: 'Super Admin',
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Create backend/.env (see server.js).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  for (const seed of SEED_USERS) {
    const password_hash = await bcrypt.hash(seed.password, 10);
    const email = seed.email.toLowerCase();

    await User.findOneAndUpdate(
      { email },
      {
        $set: {
          username: seed.username,
          email,
          full_name: seed.full_name,
          role: seed.role,
          password: password_hash,
          is_verified: true,
          status: 'Active',
        },
        $setOnInsert: {
          is_locked: false,
          is_archived: false,
          archived_at: null,
          failed_login_attempts: 0,
          last_login_attempt: null,
          last_login: null,
          lock_until: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Upserted ${seed.role} -> ${email} / ${seed.password}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
