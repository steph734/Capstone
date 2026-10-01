// GET /api/employees/:id/documents/:key/file -> streams an uploaded document
// (stored in GridFS by the create route) back to the owner's dashboard.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'

const DOC_KEYS = ['ptr', 'prc', 'diploma', 'id']

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id, key } = req.params
  if (!DOC_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Unknown document type.' })
  }
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee id.' })
  }

  try {
    await getMongo()
    const employee = await Employee.findById(id).lean()
    const fileId = employee?.documents?.[key]
    if (!fileId || !mongoose.isValidObjectId(fileId)) {
      return res.status(404).json({ error: 'No document uploaded for this field.' })
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' })
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray()
    const file = files[0]
    if (!file) return res.status(404).json({ error: 'Document not found.' })

    res.set('Content-Type', file.metadata?.contentType || file.contentType || 'application/octet-stream')
    res.set('Content-Disposition', `inline; filename="${(file.filename || key).replace(/"/g, '')}"`)
    bucket.openDownloadStream(file._id).on('error', () => res.status(404).end()).pipe(res)
  } catch (err) {
    console.error('stream employee document error:', err)
    res.status(500).json({ error: 'Could not load the document.' })
  }
}
