import { CUE_DB_TO_FRONTEND } from './speechCueMap.js'

export function serializeSpeechPhrase(doc) {
  return {
    id: String(doc._id),
    patientId: doc.patient_id ? String(doc.patient_id) : null,
    group: doc.group,
    text: doc.text,
    cue: doc.picture_cue ? (CUE_DB_TO_FRONTEND[doc.picture_cue] || null) : null,
    useCount: doc.use_count ?? 0,
  }
}
