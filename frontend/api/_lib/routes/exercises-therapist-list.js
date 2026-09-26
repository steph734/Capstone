import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { ExerciseAssignment } from '../models/exerciseAssignment.js'

// GET /api/exercises/therapist-list?email=... -> every non-archived exercise
// assignment this therapist has made, across all patients — feeds the
// "Assigned Exercises" list on the Assign Exercises page.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).lean()
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const rows = await ExerciseAssignment.find({ employee_id: employee._id, is_archived: { $ne: true } })
      .sort({ created_at: -1 })
      .lean()

    return res.status(200).json({
      assignments: rows.map((a) => ({
        id: String(a._id),
        patientId: a.patient_id ? String(a.patient_id) : null,
        patientName: a.patient_name,
        exercise: a.exercise_name,
        domain: a.domain,
        difficulty: a.difficulty,
        durationMin: a.duration_min,
        rounds: a.rounds,
        instructions: a.instructions,
        due: a.due_date,
        status: a.status,
        createdAt: a.created_at,
      })),
    })
  } catch (err) {
    console.error('exercises/therapist-list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load assignments.' })
  }
}
