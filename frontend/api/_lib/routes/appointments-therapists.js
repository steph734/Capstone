import { Employee } from '../models/employee.js'

// GET /api/appointments/therapists -> the roster a patient can pick from when
// booking, read straight from the `employees` collection the owner's Staff
// page manages — replacing the old hardcoded THERAPISTS list that used to
// live in BookAppointmentPage.jsx.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const employees = await Employee.find({ status: 'active' })
      .select('first_name middle_name last_name position specialty')
      .sort({ first_name: 1 })
      .lean()

    const therapists = employees.map((e) => ({
      id: String(e._id),
      name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
      role: e.specialty || e.position || 'Therapist',
    }))

    return res.status(200).json({ therapists })
  } catch (err) {
    console.error('appointments/therapists error:', err)
    return res.status(500).json({ error: err.message || 'Could not load therapists.' })
  }
}
