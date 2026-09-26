import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { ExerciseAssignment } from '../models/exerciseAssignment.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']
const str = (v) => (v == null ? '' : String(v).trim())

// POST /api/exercises/create -> saves one or more games from a session plan
// as assignments for a patient in one call (the Assign Exercises page
// builds a whole plan before submitting, not one game at a time).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { patientId, patientName, employeeEmail, appointmentId, dueDate, games } = req.body || {}

  const email = str(employeeEmail).toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing employeeEmail.' })
  if (!str(patientName)) return res.status(400).json({ error: 'Missing patientName.' })
  if (!DATE_RE.test(str(dueDate))) return res.status(400).json({ error: 'Invalid dueDate.' })
  if (!Array.isArray(games) || games.length === 0) {
    return res.status(400).json({ error: 'At least one game is required.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email })
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }
    const employeeName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')

    const docs = games.map((g) => ({
      patient_id: mongoose.isValidObjectId(patientId) ? new mongoose.Types.ObjectId(patientId) : null,
      patient_name: str(patientName),
      employee_id: employee._id,
      employee_name: employeeName,
      appointment_id: mongoose.isValidObjectId(appointmentId) ? new mongoose.Types.ObjectId(appointmentId) : null,
      game_id: str(g.gameId) || null,
      exercise_name: str(g.name) || 'Exercise',
      domain: DOMAINS.includes(g.domain) ? g.domain : null,
      difficulty: ['Easy', 'Medium', 'Hard'].includes(g.difficulty) ? g.difficulty : null,
      duration_min: Number.isFinite(g.durationMin) ? g.durationMin : null,
      rounds: Number.isFinite(g.rounds) ? g.rounds : null,
      instructions: str(g.instructions) || null,
      due_date: dueDate,
      status: 'Assigned',
      is_archived: false,
    }))

    const created = await ExerciseAssignment.insertMany(docs)
    return res.status(201).json({ ids: created.map((d) => String(d._id)) })
  } catch (err) {
    console.error('exercises/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the assignment.' })
  }
}
