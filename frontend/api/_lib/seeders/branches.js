// One-off dev script (same pattern as seeders/employees.js) that upserts a
// batch of sample branches into the `branchs` collection. Safe to re-run —
// it matches on `branch_name` and updates in place rather than creating
// duplicates.
//
// Usage (from the frontend/ folder, so it picks up frontend/.env):
//   node api/_lib/seeders/branches.js
import { getMongo } from '../mongo.js'
import { Branch } from '../models/branch.js'

// Node 20.6+ can load a .env file itself — no `dotenv` dependency needed.
// Falls back silently if the file isn't there (e.g. MONGO_URI already set
// in the environment) or the running Node version lacks the API.
try {
  process.loadEnvFile?.()
} catch {
  // no .env in the cwd — fine if MONGO_URI is set some other way
}

const SEED_BRANCHES = [
  { branch_name: 'Makati', address: '123 Ayala Ave, Makati City', contact_number: '+63 2 8888 1234', status: 'Active' },
  { branch_name: 'Quezon City', address: '45 Katipunan Ave, Quezon City', contact_number: '+63 2 8888 5678', status: 'Active' },
  { branch_name: 'Cebu', address: '10 Gorordo Ave, Cebu City', contact_number: '+63 32 888 9012', status: 'Active' },
  { branch_name: 'Davao', address: '88 J.P. Laurel Ave, Davao City', contact_number: '+63 82 888 3456', status: 'Active' },
  { branch_name: 'Baguio', address: '5 Session Road, Baguio City', contact_number: '+63 74 888 7890', status: 'Inactive' },
]

async function main() {
  await getMongo()
  console.log('Connected to MongoDB.')

  for (const b of SEED_BRANCHES) {
    const branch = await Branch.findOneAndUpdate(
      { branch_name: b.branch_name },
      { $set: b },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    console.log(`Upserted branch -> ${branch.branch_name}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seeder failed:', err)
  process.exit(1)
})
