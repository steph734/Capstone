// Seeds the `patients` collection with plausible demo records. Run directly
// (`node api/_lib/seeders/seedPatients.js [count]`) or import
// `seedPatients(db, count)` from another script (see index.js, which seeds
// patients then appointments that reference them).
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import {
  randomFirstName, randomLastName, randomGuardianFirstName, randomGender,
  randomAddress, randomPhone, randomEmail, randomChildBirthdate, randomRelationship,
} from './fakeData.js'

export function buildPatientDoc(now = new Date()) {
  const firstName = randomFirstName()
  const lastName = randomLastName()
  const guardianFirst = randomGuardianFirstName()
  const guardianLast = randomLastName()
  const phone = randomPhone()
  const email = randomEmail(firstName, lastName)

  return {
    // Legacy unique key the `patients` collection still indexes on (the app
    // never reads it) — same pattern appointments-create.js already follows,
    // just needs a unique value per insert so it doesn't collide on null.
    PatientID: new mongoose.Types.ObjectId().toString(),
    user_id: null,
    first_name: firstName,
    middle_name: null,
    last_name: lastName,
    nickname: null,
    gender: randomGender(),
    birthdate: randomChildBirthdate(),
    address: randomAddress(),
    contact_number: phone,
    email,
    profile_photo: null,
    guardian_first_name: guardianFirst,
    guardian_last_name: guardianLast,
    guardian_relationship: randomRelationship(),
    guardian_contact_number: phone,
    guardian_email: email,
    created_at: now,
    updated_at: now,
  }
}

export async function seedPatients(db, count = 50) {
  const now = new Date()
  const docs = Array.from({ length: count }, () => buildPatientDoc(now))
  const result = await db.collection('patients').insertMany(docs)
  return Object.values(result.insertedIds)
}

// Runnable directly: `node api/_lib/seeders/seedPatients.js [count]`
if (import.meta.url === `file://${process.argv[1]}`) {
  process.loadEnvFile?.()
  const count = Number(process.argv[2]) || 50
  await getMongo()
  const db = await getDb()
  const ids = await seedPatients(db, count)
  console.log(`Seeded ${ids.length} patients.`)
  await mongoose.disconnect()
}
