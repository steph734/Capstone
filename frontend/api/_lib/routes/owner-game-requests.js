// GET  /api/owner/game-requests?email=            -> the owner's own requests (newest first)
// POST /api/owner/game-requests (json or multipart) -> submit a new request
// Owner role checked on the server. Attachments (image/PDF, max 5 MB) live in
// `game_request_files`, never inside the request document, so listing stays light.
import multer from 'multer'
import { getMongo } from '../mongo.js'
import { requireRole, validateRequestInput, serializeRequest, oid, MAX_FILE_BYTES, FILE_TYPES } from '../gameRequests.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } }).single('file')

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (!err) return resolve()
      reject(Object.assign(new Error(err.code === 'LIMIT_FILE_SIZE' ? 'The file is too large (max 5 MB).' : 'Could not read the uploaded file.'), { status: 400 }))
    })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const isMultipart = req.method === 'POST' && req.is('multipart/form-data')
    if (isMultipart) await runUpload(req, res)
    const ctx = await requireRole(req, res, ['Owner'])
    if (!ctx) return
    const { db, user } = ctx

    if (req.method === 'GET') {
      const docs = await db.collection('game_requests')
        .find({ owner_user_id: user._id, status: { $ne: 'withdrawn' } }).sort({ created_at: -1 }).toArray()
      return res.status(200).json({ requests: docs.map((d) => serializeRequest(d)) })
    }

    const { errors, value } = validateRequestInput(req.body || {})
    const file = req.file || null
    if (file && !FILE_TYPES.includes(file.mimetype)) errors.file = 'Attach a PNG, JPG, WebP or PDF.'
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors })

    const now = new Date()
    const doc = {
      ...value,
      owner_user_id: user._id,
      owner_email: user.email,
      owner_name: user.full_name || 'Owner',
      status: 'pending',
      replies: [],
      attachment: null,
      resubmit_of: oid(req.body?.resubmitOf),
      linked_game_id: null,
      approved_at: null,
      created_at: now,
      updated_at: now,
    }
    const { insertedId } = await db.collection('game_requests').insertOne(doc)
    if (file) {
      await db.collection('game_request_files').insertOne({ request_id: insertedId, name: file.originalname, type: file.mimetype, size: file.size, data: file.buffer, created_at: now })
      await db.collection('game_requests').updateOne({ _id: insertedId }, { $set: { attachment: { name: file.originalname, type: file.mimetype, size: file.size } } })
    }
    const saved = await db.collection('game_requests').findOne({ _id: insertedId })
    return res.status(201).json({ request: serializeRequest(saved) })
  } catch (err) {
    console.error('owner/game-requests error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not save the request.' })
  }
}
