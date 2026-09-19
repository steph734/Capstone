// One-off dev script (same pattern as backend/seed-*.js) that upserts a
// handful of sample therapists into the `employees` collection, plus a
// linked `users` account for each so they can actually log in. Safe to
// re-run — it matches on `employee_id` and updates in place rather than
// erroring on the unique indexes.
//
// Usage (from the frontend/ folder, so it picks up frontend/.env):
//   node api/_lib/seeders/employees.js
import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { Branch } from '../models/branch.js'
import { Employee } from '../models/employee.js'

// Node 20.6+ can load a .env file itself — no `dotenv` dependency needed.
// Falls back silently if the file isn't there (e.g. MONGO_URI already set
// in the environment) or the running Node version lacks the API.
try {
  process.loadEnvFile?.()
} catch {
  // no .env in the cwd — fine if MONGO_URI is set some other way
}

const DEFAULT_PASSWORD = 'therapist123'

// Upserted by branch_name — reuses an existing branch instead of duplicating
// one if branches have already been seeded/created through the app.
const SEED_BRANCHES = [
  { branch_name: 'Makati', address: '123 Ayala Ave, Makati City', contact_number: '+63 2 8888 1234' },
  { branch_name: 'Quezon City', address: '45 Katipunan Ave, Quezon City', contact_number: '+63 2 8888 5678' },
]

const SEED_EMPLOYEES = [
  {
    employee_id: 'EMP-0001',
    first_name: 'Jade',
    middle_name: 'Ann',
    last_name: 'Santos',
    email: 'jade.santos@therapypro.app',
    position: 'Occupational Therapist',
    specialty: 'Pediatric Occupational Therapy',
    branch_name: 'Makati',
    phone: { country_code: '+63', number: '9171234567' },
    dob: new Date('1994-03-12'),
    gender: 'female',
    address: '12 Mabini St, Makati City',
    emergency_contact: 'Rosa Santos',
    emergency_phone: '+63 9179876543',
    prc_number: 'PRC-0012345',
    experience: 5,
    employment_type: 'Full-time',
    license_expiry: new Date('2027-06-30'),
    status: 'active',
    hired_at: new Date('2023-01-15'),
    documents: { ptr: 'seed/ptr-0001.pdf', prc: 'seed/prc-0001.pdf', diploma: 'seed/diploma-0001.pdf', id: 'seed/id-0001.pdf' },
  },
  {
    employee_id: 'EMP-0002',
    first_name: 'Miguel',
    middle_name: '',
    last_name: 'Reyes',
    email: 'miguel.reyes@therapypro.app',
    position: 'Speech Language Pathologist',
    specialty: 'Speech and Language Therapy',
    branch_name: 'Makati',
    phone: { country_code: '+63', number: '9181234567' },
    dob: new Date('1990-11-02'),
    gender: 'male',
    address: '78 Rizal Ave, Makati City',
    emergency_contact: 'Elena Reyes',
    emergency_phone: '+63 9189876543',
    prc_number: 'PRC-0023456',
    experience: 8,
    employment_type: 'Full-time',
    license_expiry: new Date('2026-09-30'),
    status: 'active',
    hired_at: new Date('2021-07-01'),
    documents: { ptr: 'seed/ptr-0002.pdf', prc: 'seed/prc-0002.pdf', diploma: 'seed/diploma-0002.pdf', id: 'seed/id-0002.pdf' },
  },
  {
    employee_id: 'EMP-0003',
    first_name: 'Carla',
    middle_name: 'Dela Cruz',
    last_name: 'Tan',
    email: 'carla.tan@therapypro.app',
    position: 'Physical Therapist',
    specialty: 'Physical Rehabilitation',
    branch_name: 'Quezon City',
    phone: { country_code: '+63', number: '9191234567' },
    dob: new Date('1996-05-20'),
    gender: 'female',
    address: '9 Aurora Blvd, Quezon City',
    emergency_contact: 'Ben Tan',
    emergency_phone: '+63 9199876543',
    prc_number: 'PRC-0034567',
    experience: 3,
    employment_type: 'Part-time',
    license_expiry: new Date('2028-01-31'),
    status: 'on_leave',
    hired_at: new Date('2024-02-10'),
    documents: { ptr: 'seed/ptr-0003.pdf', prc: 'seed/prc-0003.pdf', diploma: 'seed/diploma-0003.pdf', id: 'seed/id-0003.pdf' },
  },
  {
    employee_id: 'EMP-0004',
    first_name: 'Noel',
    middle_name: '',
    last_name: 'Bautista',
    email: 'noel.bautista@therapypro.app',
    position: 'Occupational Therapist',
    specialty: 'Adult Occupational Therapy',
    branch_name: 'Quezon City',
    phone: { country_code: '+63', number: '9201234567' },
    dob: new Date('1988-08-08'),
    gender: 'male',
    address: '221 Commonwealth Ave, Quezon City',
    emergency_contact: 'Grace Bautista',
    emergency_phone: '+63 9209876543',
    prc_number: 'PRC-0045678',
    experience: 12,
    employment_type: 'Contract',
    license_expiry: new Date('2025-12-31'),
    status: 'inactive',
    hired_at: new Date('2019-04-22'),
    documents: { ptr: 'seed/ptr-0004.pdf', prc: 'seed/prc-0004.pdf', diploma: 'seed/diploma-0004.pdf', id: 'seed/id-0004.pdf' },
  },
]

async function upsertBranches() {
  const branchIdByName = new Map()
  for (const b of SEED_BRANCHES) {
    const branch = await Branch.findOneAndUpdate(
      { branch_name: b.branch_name },
      { $set: b, $setOnInsert: { status: 'Active' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    branchIdByName.set(branch.branch_name, branch._id)
    console.log(`Upserted branch -> ${branch.branch_name}`)
  }
  return branchIdByName
}

async function upsertEmployeeUser(seed) {
  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  const username = seed.email.split('@')[0]
  const full_name = [seed.first_name, seed.middle_name, seed.last_name].filter(Boolean).join(' ')

  const user = await User.findOneAndUpdate(
    { email: seed.email },
    {
      $set: { full_name, role: 'Therapist', is_verified: true, status: 'Active' },
      $setOnInsert: { username, password: password_hash },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  return user
}

async function main() {
  await getMongo()
  console.log('Connected to MongoDB.')

  const branchIdByName = await upsertBranches()

  for (const seed of SEED_EMPLOYEES) {
    const branchId = branchIdByName.get(seed.branch_name)
    if (!branchId) {
      console.warn(`Skipping ${seed.employee_id}: unknown branch "${seed.branch_name}".`)
      continue
    }

    const user = await upsertEmployeeUser(seed)

    const { branch_name, ...employeeFields } = seed
    await Employee.findOneAndUpdate(
      { employee_id: seed.employee_id },
      {
        $set: {
          ...employeeFields,
          user_id: user._id,
          branch_id: branchId,
        },
        $setOnInsert: { approved_at: seed.status === 'active' || seed.status === 'on_leave' ? new Date() : null },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    console.log(`Upserted employee -> ${seed.employee_id} (${employeeFields.first_name} ${employeeFields.last_name}) / login: ${seed.email} / ${DEFAULT_PASSWORD}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seeder failed:', err)
  process.exit(1)
})
