import { CUE_DB_TO_FRONTEND } from './speechCueMap.js'

export function serializeSpeechMessage(doc) {
  return {
    id: String(doc._id),
    patientId: doc.patient_id ? String(doc.patient_id) : null,
    patientName: doc.patient_name || null,
    sessionId: doc.session_id || null,
    text: doc.input_text,
    phraseGroup: doc.phrase_group,
    phraseId: doc.phrase_id ? String(doc.phrase_id) : null,
    speed: doc.speed ?? 1,
    repeatCount: doc.repeat_count ?? 1,
    cue: doc.picture_cue ? (CUE_DB_TO_FRONTEND[doc.picture_cue] || null) : null,
    replayCount: doc.replay_count ?? 0,
    createdAt: doc.created_at,
  }
}
