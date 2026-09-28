// Seeds patients, then appointments that link to them (and to whatever
// active employees already exist). Run with:
//   node api/_lib/seeders/index.js [count]
// `count` applies to both collections (defaults to 50 each).
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { seedPatients } from './seedPatients.js'
import { seedAppointments } from './seedAppointments.js'

process.loadEnvFile?.()

const count = Number(process.argv[2]) || 50

await getMongo()
const db = await getDb()

const patientIds = await seedPatients(db, count)
console.log(`Seeded ${patientIds.length} patients.`)

const patients = await db.collection('patients').find({ _id: { $in: patientIds } }).toArray()
const appointmentIds = await seedAppointments(db, count, { patients })
console.log(`Seeded ${appointmentIds.length} appointments.`)

await mongoose.disconnect()
