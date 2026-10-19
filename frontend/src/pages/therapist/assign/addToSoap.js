import { authFetch } from '../../../utils/session'

// "Add results to SOAP notes": puts the play-time summary into the Objective section of today's note for this patient.
// Uses the normal notes routes, so encryption, versions and the audit log all apply:
//   today's draft exists  -> its Objective gets the text appended (undo puts the old text back)
//   no draft yet          -> a new draft note is created with the text in Objective
// Returns { text, undo? }.
export async function addResultsToSoap({ planId, patientId, today }) {
  const { text } = await authFetch(`/api/game-plans/${planId}/soap-summary`, { method: 'POST' })
  const list = await authFetch('/api/notes/therapist-list')
  const draft = (list.notes || []).find((n) => n.patientId === patientId && n.status === 'draft' && !n.voided && String(n.date).slice(0, 10) === today)
  if (!draft) {
    await authFetch('/api/notes/create', { method: 'POST', body: { patientId, sessionDate: today, objective: text } })
    return { text, created: true }
  }
  const { note } = await authFetch(`/api/notes/${draft.id}`)
  const before = { subjective: note.subjective || '', objective: note.objective || '', assessment: note.assessment || '', plan: note.plan || '' }
  const patch = (obj) => authFetch(`/api/notes/${draft.id}`, { method: 'PATCH', body: { ...before, objective: obj } })
  await patch(before.objective ? `${before.objective.trimEnd()}\n${text}` : text)
  return { text, undo: () => patch(before.objective) }
}
