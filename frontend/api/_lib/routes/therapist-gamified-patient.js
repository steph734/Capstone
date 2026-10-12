// GET /api/therapist/gamified/patients/:patientId?email=&range=7|30|90
// -> the full per-patient Gamified Stats dashboard (see
// gamifiedPatientStats.js for what's in it). The therapist must be the one
// actually assigned to this patient (same appointments-based link used
// everywhere else), or this returns 403.
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { buildPatientStats } from '../gamifiedPatientStats.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientId = String(req.params?.patientId || '')
  if (!mongoose.isValidObjectId(patientId)) return res.status(400).json({ error: 'Invalid patient id.' })
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing email.' })
  const days = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).lean()
    if (!employee) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const db = await getDb()
    const pid = new mongoose.Types.ObjectId(patientId)

    // Access check: this therapist must actually be assigned to this patient.
    const linked = await db.collection('appointments').findOne({ employee_id: employee._id, patient_id: pid })
    if (!linked) return res.status(403).json({ error: "You don't have access to this patient." })

    const payload = await buildPatientStats(db, pid, days)
    if (!payload) return res.status(404).json({ error: 'Patient not found.' })
    return res.status(200).json(payload)
  } catch (err) {
    console.error('therapist/gamified/patients/:id error:', err)
    return res.status(500).json({ error: err.message || 'Could not load this patient’s stats.' })
  }
}
