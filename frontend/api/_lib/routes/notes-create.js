import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { TherapyNote } from '../models/therapyNote.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const str = (v) => (v == null ? '' : String(v).trim())

// POST /api/notes/create -> a signed SOAP session note, written straight to
// the `therapy_notes` collection. The Notes & Progress page always signs on
// save (there's no separate "save as draft" step in the UI yet), so this
// always writes status: 'signed' with a signature image and a signed_at/by.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    patientId, patientName, diagnosis, employeeEmail, sessionDate,
    subjective, objective, assessment, plan, signatureImage,
    domain, shareWithGuardian, parentSummary,
  } = req.body || {}

  const email = str(employeeEmail).toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing employeeEmail.' })
  if (!mongoose.isValidObjectId(patientId)) return res.status(400).json({ error: 'Invalid patientId.' })
  if (!DATE_RE.test(str(sessionDate))) return res.status(400).json({ error: 'Invalid sessionDate.' })
  if (!str(subjective) || !str(objective) || !str(assessment) || !str(plan)) {
    return res.status(400).json({ error: 'All SOAP fields (subjective/objective/assessment/plan) are required.' })
  }
  if (!str(signatureImage)) {
    return res.status(400).json({ error: 'A signature is required to save a session note.' })
  }
  const share = !!shareWithGuardian
  if (share && !str(parentSummary)) {
    return res.status(400).json({ error: 'A parent-friendly summary is required when sharing this note.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email })
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    // Confirm the patient actually exists (raw driver — `patients` isn't
    // modeled via Mongoose anywhere in this app yet).
    const db = await getDb()
    const patientObjId = new mongoose.Types.ObjectId(patientId)
    const patient = await db.collection('patients').findOne({ _id: patientObjId }, { projection: { _id: 1 } })
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' })
    }

    const employeeName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    const now = new Date()

    const doc = await TherapyNote.create({
      employee_id: employee._id,
      employee_name: employeeName,
      patient_id: patientObjId,
      patient_name: str(patientName) || null,
      diagnosis: str(diagnosis) || null,
      title: share ? (str(domain) || null) : null,
      session_date: sessionDate,
      timezone: 'Asia/Manila',
      subjective: str(subjective),
      objective: str(objective),
      assessment: str(assessment),
      plan: str(plan),
      status: 'signed',
      signature_image: signatureImage,
      signed_at: now,
      signed_by: employee._id,
      shared_with_guardian: share,
      shared_summary: share ? str(parentSummary) : null,
      shared_at: share ? now : null,
      is_archived: false,
    })

    return res.status(201).json({
      id: String(doc._id),
      date: doc.session_date,
      createdAt: doc.created_at,
    })
  } catch (err) {
    console.error('notes/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the session note.' })
  }
}
