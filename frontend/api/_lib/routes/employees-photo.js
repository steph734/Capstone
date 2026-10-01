// GET /api/employees/:id/photo -> streams the staff member's profile photo,
// same GridFS bucket/pattern as the documents route.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'

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
      return res.status(404).json({ error: 'No photo uploaded for this employee.' })
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' })
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray()
    const file = files[0]
    if (!file) return res.status(404).json({ error: 'Photo not found.' })

    res.set('Content-Type', file.metadata?.contentType || file.contentType || 'application/octet-stream')
    bucket.openDownloadStream(file._id).on('error', () => res.status(404).end()).pipe(res)
  } catch (err) {
    console.error('stream employee photo error:', err)
    res.status(500).json({ error: 'Could not load the photo.' })
  }
}
