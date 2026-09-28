import { getDb } from '../mongo.js'

// GET /api/patient-photos/:publicId -> the raw image bytes for a child's
// profile photo. `publicId` is a random 32-hex token stored on the
// patient_photos document (not the Mongo _id), so this URL can't be guessed
// or enumerated the way a sequential/ObjectId-based one could.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const publicId = String(req.params?.publicId || '').trim().toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(publicId)) {
    return res.status(400).json({ error: 'Invalid photo id.' })
  }

  try {
    const db = await getDb()
    const doc = await db.collection('patient_photos').findOne(
      { public_id: publicId },
      { projection: { content_type: 1, data: 1 } }
    )
    if (!doc) return res.status(404).json({ error: 'Photo not found.' })

    const bytes = doc.data?.buffer ? Buffer.from(doc.data.buffer) : Buffer.from(doc.data)
    res.setHeader('Content-Type', doc.content_type || 'image/webp')
    // The bytes behind a public_id never change (a "change photo" upload
    // gets its own fresh public_id), so this is safe to cache for a long time.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return res.status(200).send(bytes)
  } catch (err) {
    console.error('patient-photos/item error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the photo.' })
  }
}
