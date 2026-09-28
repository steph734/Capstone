// Shared shape mapper for the recordings routes.
export function serializeRecording(doc) {
  return {
    id: String(doc._id),
    therapistEmail: doc.therapist_email,
    patientId: doc.patient_id ? String(doc.patient_id) : null,
    patientName: doc.patient_name || null,
    title: doc.title,
    transcript: doc.transcript || '',
    segments: (doc.segments || []).map((s) => ({ t: s.t, text: s.text })),
    durationSec: doc.duration_sec,
    wordCount: doc.word_count,
    summary: doc.summary ? {
      overview: doc.summary.overview || '',
      goals: doc.summary.goals || [],
      progress: doc.summary.progress || [],
      nextSteps: doc.summary.next_steps || [],
      generatedAt: doc.summary.generated_at,
    } : null,
    summaryStatus: doc.summary_status,
    audioKey: doc.audio_key,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
