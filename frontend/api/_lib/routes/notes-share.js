import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { TherapyNote } from '../models/therapyNote.js'

// PATCH /api/notes/:id/share -> toggles shared_with_guardian on a note (the
// "Share"/"Unshare" button on the patient's note list). Turning it on sets
// shared_summary/shared_at/title(domain); turning it off clears them rather
// than leaving stale parent-facing content behind.
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid note id.' })
  }

  const shared = !!req.body?.shared
  const domain = req.body?.domain != null ? String(req.body.domain).trim() : ''
  const summary = req.body?.summary != null ? String(req.body.summary).trim() : ''

  if (shared && !summary) {
    return res.status(400).json({ error: 'A parent-friendly summary is required to share this note.' })
  }

  try {
    await getMongo()
    const update = shared
      ? { shared_with_guardian: true, shared_summary: summary, shared_at: new Date(), title: domain || null }
      : { shared_with_guardian: false, shared_summary: null, shared_at: null }

    const doc = await TherapyNote.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
    if (!doc) {
      return res.status(404).json({ error: 'Note not found.' })
    }

    return res.status(200).json({
      id: String(doc._id),
      sharedWithGuardian: !!doc.shared_with_guardian,
      sharedSummary: doc.shared_summary,
      domain: doc.title,
    })
  } catch (err) {
    console.error('notes/share error:', err)
    return res.status(500).json({ error: err.message || 'Could not update sharing for this note.' })
  }
}
