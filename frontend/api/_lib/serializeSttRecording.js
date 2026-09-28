const AUDIO_PREFIX = 'indexeddb:'

export function serializeSttRecording(doc) {
  return {
    id: String(doc._id),
    patientId: doc.patient_id ? String(doc.patient_id) : null,
    patientName: doc.patient_name || null,
    sessionId: doc.session_id || null,
    title: doc.title || 'Untitled session',
    transcript: doc.transcript || '',
    segments: (doc.segments || []).map((s) => ({ t: s.t, text: s.text })),
    durationSec: doc.duration_seconds ?? 0,
    wordCount: doc.word_count ?? 0,
    summary: doc.summary ? {
      overview: doc.summary.overview || '',
      goals: doc.summary.goals || [],
      progress: doc.summary.progress || [],
      nextSteps: doc.summary.next_steps || [],
      generatedAt: doc.summary.generated_at,
    } : null,
    summaryStatus: doc.summary_status,
    audioKey: doc.file_path && doc.file_path.startsWith(AUDIO_PREFIX) ? doc.file_path.slice(AUDIO_PREFIX.length) : null,
    isArchived: !!doc.is_archived,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

export function audioKeyToFilePath(audioKey) {
  return audioKey ? `${AUDIO_PREFIX}${audioKey}` : null
}
