import { getMongo } from '../mongo.js'
import { SpeechToTextRecording } from '../models/speechToTextRecording.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSttRecording, audioKeyToFilePath } from '../serializeSttRecording.js'

const str = (v) => (v == null ? '' : String(v).trim())

// POST /api/speech-recordings/create -> save a finished recording's metadata
// to speech_to_text_recordings. The audio itself lives in the browser's
// IndexedDB (there's no file storage provider wired up), so file_path is
// reused as a pointer back to it (`indexeddb:<key>`) rather than a real URL.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    therapistEmail, patientId, patientName, sessionId, title, transcript, segments,
    durationSec, wordCount, audioKey, fileSize,
  } = req.body || {}

  if (!str(therapistEmail)) return res.status(400).json({ error: 'Missing therapistEmail.' })
  if (!str(audioKey)) return res.status(400).json({ error: 'Missing audioKey.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const validPatientId = patientId && /^[0-9a-fA-F]{24}$/.test(patientId) ? patientId : null

    const doc = await SpeechToTextRecording.create({
      created_by: creator.id,
      created_by_role: creator.role,
      created_by_name: creator.name,
      patient_id: validPatientId,
      patient_name: str(patientName) || null,
      branch_id: creator.branchId,
      session_id: str(sessionId) || null,
      title: str(title) || 'Untitled session',
      transcript: str(transcript),
      segments: Array.isArray(segments) ? segments.filter((s) => s && str(s.text)).map((s) => ({ t: Number(s.t) || 0, text: str(s.text) })) : [],
      word_count: Number.isFinite(wordCount) ? wordCount : 0,
      summary: null,
      summary_status: str(transcript) ? 'pending' : 'none',
      file_path: audioKeyToFilePath(str(audioKey)),
      mime_type: 'audio/webm',
      file_size: Number.isFinite(fileSize) ? fileSize : null,
      duration_seconds: Number.isFinite(durationSec) ? durationSec : 0,
      status: 'active',
      is_archived: false,
      is_deleted: false,
    })

    return res.status(201).json({ recording: serializeSttRecording(doc) })
  } catch (err) {
    console.error('speech-recordings/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the recording.' })
  }
}
