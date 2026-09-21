// One-off dev script (same pattern as seeders/branches.js and
// seeders/employees.js) that upserts the fixed Owner and Super Admin accounts
// into the `users` collection so they're always available for login testing.
// Safe to re-run — it matches on `email` and updates the password hash in
// place instead of erroring on the unique email/username indexes.
//
// Usage (from the frontend/ folder, so it picks up frontend/.env):
//   node api/_lib/seeders/owner-superadmin.js
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'

// Node 20.6+ can load a .env file itself — no `dotenv` dependency needed.
// Falls back silently if the file isn't there (e.g. MONGO_URI already set
// in the environment) or the running Node version lacks the API.
try {
  process.loadEnvFile?.()
} catch {
  // no .env in the cwd — fine if MONGO_URI is set some other way
}

// The login form (src/utils/hash.js) SHA-256-hashes the password in the
// browser before it ever reaches the server, so `/api/auth/login` only ever
// sees that digest, never the raw password. Stored hashes must therefore be
// bcrypt(sha256hex(password)), not bcrypt(password) — otherwise these seeded
// accounts would fail to log in through the UI.
function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

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
]

async function upsertUser(seed) {
  const password_hash = await bcrypt.hash(sha256Hex(seed.password), 10)
  const email = seed.email.toLowerCase()

  const user = await User.findOneAndUpdate(
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
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  return user
}

async function main() {
  await getMongo()
  console.log('Connected to MongoDB.')

  for (const seed of SEED_USERS) {
    await upsertUser(seed)
    console.log(`Upserted ${seed.role} -> ${seed.email} / ${seed.password}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seeder failed:', err)
  process.exit(1)
})
