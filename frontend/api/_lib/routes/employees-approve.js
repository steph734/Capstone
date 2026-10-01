// PATCH /api/employees/:id/approve -> owner signs off on a hire's uploaded
// documents, moving them out of "For Review" and into the Employees list.
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { Employee } from '../models/employee.js'
import { sendHiredEmail } from '../employeeEmails.js'
import { INVITE_TTL_MS, generateInviteToken, hashInviteToken } from '../staffInvite.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findById(id).populate('user_id', 'is_verified email full_name')
    if (!employee) return res.status(404).json({ error: 'Employee not found.' })
    if (!employee.user_id?.is_verified) {
      return res.status(400).json({ error: 'This hire has not finished uploading their documents yet.' })
    }

    // Generate the real login password only now — the placeholder hash set
    // at creation was never meant to be handed out. Bcrypt-hash its SHA-256
    // digest, matching how every password this app ever receives (login,
    // signup, reset, and the "set password" link this gets emailed with) is
    // pre-hashed client-side before it hits bcrypt.
    const tempPassword = crypto.randomBytes(9).toString('base64url')
    const tempPasswordDigest = crypto.createHash('sha256').update(tempPassword).digest('hex')
    const password_hash = await bcrypt.hash(tempPasswordDigest, 10)
    const setupToken = generateInviteToken()
    const setupTokenHash = hashInviteToken(setupToken)
    await User.updateOne(
      { _id: employee.user_id._id },
      {
        $set: {
          password: password_hash,
          password_change_at: null,
          must_set_password: true,
          password_setup_token_hash: setupTokenHash,
          password_setup_expires_at: new Date(Date.now() + INVITE_TTL_MS),
        },
      }
    )

    employee.approved_at = new Date()
    if (employee.status === 'for_review') employee.status = 'active'
    await employee.save()

    const name = employee.user_id.full_name || `${employee.first_name} ${employee.last_name}`.trim()
    try {
      await sendHiredEmail({ email: employee.user_id.email, name, tempPassword, setupToken })
    } catch (err) {
      console.error('send hired email error:', err)
    }

    return res.json({ success: true, employee, tempPassword })
  } catch (err) {
    console.error('approve employee error:', err)
    return res.status(500).json({ error: 'Could not approve this employee.' })
  }
}
