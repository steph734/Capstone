import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getDb } from '../mongo.js';

// Must match the client-side hashing in the login form exactly —
// login now sends bcrypt.compare(sha256Hex(rawPassword), storedHash),
// so seeded accounts have to be stored the same way or they won't authenticate.
function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const SEED_USERS = [
  {
    username: 'owner',
    email: 'owner@gmail.com',
    password: 'owner123', // raw password — hashed below, never stored as-is
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
  const db = await getDb();

  for (const seed of SEED_USERS) {
    const hashedPassword = await bcrypt.hash(sha256Hex(seed.password), 10);

    const result = await db.collection('users').findOneAndUpdate(
      { email: seed.email },
      {
        $set: {
          username: seed.username,
          email: seed.email,
          password: hashedPassword,
          full_name: seed.full_name,
          role: seed.role,
          is_verified: true,
          status: 'active',
          is_locked: false,
          is_archived: false,
          failed_login_attempts: 0,
          updated_at: new Date(),
        },
        $setOnInsert: {
          created_at: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`Upserted user -> ${seed.role} / login: ${seed.email} / ${seed.password}`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err.message);
  if (err.errInfo?.details) {
    console.error('Validation details:', JSON.stringify(err.errInfo.details, null, 2));
  }
  process.exit(1);
});