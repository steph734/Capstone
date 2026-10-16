// GET /api/employees/:id/photo -> streams the staff member's profile photo,
// same GridFS bucket/pattern as the documents route.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'

// The photo is only ever used as an <img src>, so a missing file answers with an
// initials avatar (200) instead of a 404 that would spam the browser console.
function initialsAvatar(res, employee) {
  const name = [employee?.first_name, employee?.last_name].filter(Boolean).join(' ')
  const initials = name.split(/s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#4a6b5d"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="700" fill="#fff">${initials.replace(/[<>&]/g, '')}</text></svg>`
  res.set('Content-Type', 'image/svg+xml')
  res.set('Cache-Control', 'public, max-age=300')
  return res.status(200).send(svg)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findById(id).lean()
    const fileId = employee?.profile_picture?.storage_key
    if (!fileId || !mongoose.isValidObjectId(fileId)) {
      return employee ? initialsAvatar(res, employee) : res.status(404).json({ error: 'Employee not found.' })
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' })
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray()
    const file = files[0]
    if (!file) return initialsAvatar(res, employee)

    res.set('Content-Type', file.metadata?.contentType || file.contentType || 'application/octet-stream')
    bucket.openDownloadStream(file._id).on('error', () => (res.headersSent ? res.end() : initialsAvatar(res, employee))).pipe(res)
  } catch (err) {
    console.error('stream employee photo error:', err)
    res.status(500).json({ error: 'Could not load the photo.' })
  }
}
