// DELETE /api/employees/:id -> owner rejects a reviewed hire; since they were
// never actually hired, this removes both the Employee record and its linked
// (still-unhired) User account.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { Employee } from '../models/employee.js'
import { sendRejectedEmail } from '../employeeEmails.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findById(id)
    if (!employee) return res.status(404).json({ error: 'Employee not found.' })

    const body = req.body || {}
    const reason = String(body.reason || '').trim()
    const note = String(body.note || '').trim()
    const name = `${employee.first_name} ${employee.last_name}`.trim()

    // Send the notice before deleting — once the records are gone there's
    // nothing left to read the applicant's email/name from.
    if (employee.email && reason) {
      try {
        await sendRejectedEmail({ email: employee.email, name, reason, note })
      } catch (err) {
        console.error('send rejected email error:', err)
      }
    }

    await Employee.deleteOne({ _id: id })
    await User.deleteOne({ _id: employee.user_id }).catch(() => {})
    return res.json({ success: true })
  } catch (err) {
    console.error('reject employee error:', err)
    return res.status(500).json({ error: 'Could not reject this applicant.' })
  }
}
