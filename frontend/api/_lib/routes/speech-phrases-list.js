import { getMongo } from '../mongo.js'
import { SpeechPhrase } from '../models/speechPhrase.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSpeechPhrase } from '../serializeSpeechPhrase.js'

// GET /api/speech-phrases/list?therapistEmail=&patientId= -> this
// therapist's custom phrases: ones saved for every patient (patient_id null)
// plus ones saved specifically for the given patient.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const therapistEmail = String(req.query.therapistEmail || '').trim().toLowerCase()
  const patientId = req.query.patientId ? String(req.query.patientId) : null
  if (!therapistEmail) return res.status(400).json({ error: 'Missing therapistEmail.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(200).json({ phrases: [] })

    const query = {
      created_by: creator.id,
      is_deleted: false,
      $or: [{ patient_id: null }, ...(patientId && /^[0-9a-fA-F]{24}$/.test(patientId) ? [{ patient_id: patientId }] : [])],
    }

    const docs = await SpeechPhrase.find(query).sort({ sort_order: 1, created_at: 1 })
    return res.status(200).json({ phrases: docs.map(serializeSpeechPhrase) })
  } catch (err) {
    console.error('speech-phrases/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load phrases.' })
  }
}
