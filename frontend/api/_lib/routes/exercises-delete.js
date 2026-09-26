import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { ExerciseAssignment } from '../models/exerciseAssignment.js'

// DELETE /api/exercises/:id -> removes one assignment. The "Delete" button
// on the Assigned Exercises list means "take this off the list" with no
// undo, so this is a real delete rather than an archive flag.
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid assignment id.' })
  }

  try {
    await getMongo()
    const doc = await ExerciseAssignment.findByIdAndDelete(id).lean()
    if (!doc) {
      return res.status(404).json({ error: 'Assignment not found.' })
    }
    return res.status(200).json({ id: String(doc._id) })
  } catch (err) {
    console.error('exercises/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the assignment.' })
  }
}
