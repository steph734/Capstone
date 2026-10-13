// POST /api/admin/builder/assets  (multipart: file)  -> store a game image
// GET  /api/admin/builder/assets                    -> the image library (metadata)
// GET  /api/game-assets/:id                         -> serve an image (public: patients load these)
// Super Admin only for upload/list. Images (PNG/JPEG/WebP, max 2 MB) are kept
// in the `game_assets` collection and served with a fixed content type, so a
// file can never be run as a script. (SVG is refused for that reason.)
import multer from 'multer'
import { ObjectId, Binary } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single('file')
const runUpload = (req, res) => new Promise((resolve, reject) => upload(req, res, (err) => (err ? reject(Object.assign(new Error(err.code === 'LIMIT_FILE_SIZE' ? 'Images can be up to 2 MB.' : 'Could not read the file.'), { status: 400 })) : resolve())))

// Magic-number check so a renamed non-image can't be stored.
function looksLikeImage(buf, type) {
  if (type === 'image/png') return buf.length > 8 && buf.subarray(0, 4).toString('hex') === '89504e47'
  if (type === 'image/jpeg') return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8
  if (type === 'image/webp') return buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP'
  return false
}

export default async function handler(req, res) {
  try {
    await getMongo()
    // Public read of a single image.
    if (req.params?.assetId) {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
      if (!ObjectId.isValid(req.params.assetId)) return res.status(404).json({ error: 'Not found.' })
      const { getDb } = await import('../mongo.js')
      const db = await getDb()
      const a = await db.collection('game_assets').findOne({ _id: new ObjectId(req.params.assetId) })
      if (!a) return res.status(404).json({ error: 'Not found.' })
      res.setHeader('Content-Type', a.type)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return res.status(200).send(Buffer.from(a.data.buffer))
    }

    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (req.method === 'POST' && req.is('multipart/form-data')) await runUpload(req, res)
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { db, user } = ctx

    if (req.method === 'GET') {
      const rows = await db.collection('game_assets').find({}, { projection: { data: 0 } }).sort({ created_at: -1 }).limit(200).toArray()
      return res.status(200).json({ assets: rows.map((a) => ({ id: String(a._id), url: `/api/game-assets/${a._id}`, name: a.name, size: a.size, createdAt: a.created_at })) })
    }

    const f = req.file
    if (!f) return res.status(400).json({ error: 'Choose an image to upload.' })
    if (!TYPES.includes(f.mimetype) || !looksLikeImage(f.buffer, f.mimetype)) return res.status(400).json({ error: 'Upload a PNG, JPG or WebP image.' })
    const doc = { name: String(f.originalname || 'image').slice(0, 120), type: f.mimetype, size: f.size, data: new Binary(f.buffer), created_by: user._id, created_at: new Date() }
    const { insertedId } = await db.collection('game_assets').insertOne(doc)
    return res.status(201).json({ asset: { id: String(insertedId), url: `/api/game-assets/${insertedId}`, name: doc.name, size: doc.size } })
  } catch (err) {
    console.error('builder assets error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not handle that image.' })
  }
}
