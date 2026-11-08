// When a home-practice set is finished (every game used its plays) the server prepares two DRAFTS for the therapist:
//   1. a home-practice SOAP note, written from the recorded plays only (numbers equal what Patient Stats shows for the set)
//   2. a recommended next set with a reason for every game (homeSetRecommend.js)
// Nothing is signed, shared or assigned automatically: the therapist reviews and edits both. Only a SIGNED note unlocks the next set.
//
// The draft is an ordinary note in `therapy_notes` (encrypted, versioned and audited like every note) with note_type 'home_practice'.
// The review state (which sections were ticked as reviewed, the edit history, a hash of each auto-written text) lives on the set in
// `soap_meta`, so the note itself needs no new schema. Generation is idempotent: a claim on the set makes sure it runs once.
import { createHash } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { SOAP_FIELDS, cleanText, decryptField, encryptField } from './soapCrypto.js'
import { manilaToday } from './manilaDate.js'
import { audit } from './noteAccess.js'
import { notify } from './sessionRecommendations.js'
import { buildSetStats } from './homeSetStats.js'
import { masteryForGames, setIsComplete } from './homeSets.js'
import { HOME_PLAYS_PER_GAME } from './homeSetConfig.js'
import { lowestStat, recommend } from './homeSetRecommend.js'

export const SUBJECTIVE_MARK = '[Add the caregiver report'
const SECTION_LABEL = { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' }
const sha = (t) => createHash('sha256').update(String(t || '')).digest('hex')
const toId = (v) => { try { return v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null } catch { return null } }
const httpError = (status, message, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) })
const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '')
const day = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

// The four sections, written from data only. Interpretation is hedged ("suggests", "may"); nothing is diagnosed or predicted.
export function draftSections({ stats, rec, first, setNumber }) {
  const { data, selected: sel } = stats
  const h = data.totals.home, t = data.totals.session
  const games = data.perGame
  const fmtPlays = (g) => g.playList.map((p) => (p.accuracy == null ? '—' : `${p.accuracy}%`)).join(', ')
  const playDays = new Set(data.accuracySeries.home.map((p) => p.date)).size
  const names = games.map((g) => g.name)
  const next = rec.games.map((g) => g.name)

  const subjective = `${SUBJECTIVE_MARK}: what the caregiver or ${first} said about practicing at home.]\nFrom the app: ${first} played on ${playDays} separate day${playDays === 1 ? '' : 's'} and used all ${HOME_PLAYS_PER_GAME} plays of every game.`
  const objective = `${sel.playsUsed} of ${sel.playsAllowed} home plays used across ${joinNames(names)} (${day(sel.startedAt)} – ${day(sel.endedAt || new Date())}). Home accuracy ${h.accuracy != null ? `${Math.round(h.accuracy)}%` : '—'}${t.accuracy != null ? ` (therapy ${Math.round(t.accuracy)}%)` : ''}. ${games.map((g) => `${g.name} ${fmtPlays(g)}.`).join(' ')} ${h.mistakes} mistake${h.mistakes === 1 ? '' : 's'} in total, ${h.hints} hint${h.hints === 1 ? '' : 's'}, ${h.minutes} min of play.`

  const parts = []
  const high = games.filter((g) => g.home.accuracy != null && g.home.accuracy >= 90)
  if (high.length) parts.push(`Accuracy stayed high on ${joinNames(high.map((g) => `${g.name} (${Math.round(g.home.accuracy)}%)`))}.`)
  for (const g of games) {
    const a = g.playList[0]?.accuracy, b = g.playList[2]?.accuracy
    if (a == null || b == null) continue
    if (b - a >= 10) parts.push(`${g.name} rose from ${a}% to ${b}% (+${b - a} pts) over three plays${rec.games.length ? ', which may suggest growing familiarity with the task' : ''}.`)
    else if (a - b >= 10) parts.push(`${g.name} dropped from ${a}% to ${b}% (${a - b} pts) over three plays and may be worth another look in clinic.`)
  }
  if (stats.lowest) parts.push(`${stats.lowest.label} is still ${first}'s lowest character stat (${stats.lowest.value} / 100).`)
  const assessment = parts.join(' ') || `${first} used all plays of every game in this set.`

  const plan = `${next.length ? `Start Set ${setNumber + 1} (${joinNames(next)}) in the next therapy session and at home.` : `Choose Set ${setNumber + 1} games.`}${rec.reviewGame ? ` ${rec.reviewGame.reason}` : ''} Re-check progress after Set ${setNumber + 1}.`

  const basedOn = {
    subjective: ['App play days'],
    objective: [`${h.plays} home plays`, `${t.plays} therapy plays`, 'Mistakes & hints', 'Play time'],
    assessment: ['Play scores', ...(stats.lowest ? ['Character stats'] : [])],
    plan: [next.length ? `Recommended Set ${setNumber + 1}` : 'Next set'],
  }
  return { text: { subjective, objective, assessment, plan }, basedOn }
}

async function authorFor(db, set) {
  const plan = set.plan_id ? await db.collection('home_practice_plans').findOne({ _id: set.plan_id }, { projection: { therapist_id: 1 } }) : null
  const id = plan?.therapist_id || set.created_by
  if (id) { const e = await db.collection('employees').findOne({ _id: id }); if (e) return e }
  const a = await db.collection('patient_assign').findOne({ patient_id: set.patient_id, status: 'active' })
  return a ? db.collection('employees').findOne({ _id: a.employee_id }) : null
}

// Writes the four sections into a note (encrypted) and keeps the version history the notes feature already has.
async function writeSections(db, noteId, text, { kind, userId = null, create = null }) {
  const id = String(noteId)
  const clean = Object.fromEntries(SOAP_FIELDS.map((f) => [f, cleanText(text[f] || '')]))
  const enc = Object.fromEntries(SOAP_FIELDS.map((f) => [f, clean[f] ? encryptField(clean[f], id, f) : null]))
  const now = new Date()
  if (create) {
    await db.collection('therapy_notes').insertOne({ _id: noteId, NoteID: id, ...create, ...enc, status: 'draft', signature_image: null, signed_at: null, signed_by: null, content_hash: null, shared_with_guardian: false, shared_summary: null, shared_at: null, addendum_to: null, voided: false, version: 1, enc: 1, is_archived: false, archived_at: null, created_at: now, updated_at: now })
    await db.collection('soap_note_versions').insertOne({ note_id: noteId, version: 1, kind, ...enc, content_hash: null, created_by: userId, created_at: now })
  } else {
    const note = await db.collection('therapy_notes').findOne({ _id: noteId }, { projection: { version: 1 } })
    const version = (note?.version || 1) + 1
    await db.collection('therapy_notes').updateOne({ _id: noteId }, { $set: { ...enc, version, updated_at: now } })
    await db.collection('soap_note_versions').insertOne({ note_id: noteId, version, kind, ...enc, content_hash: null, created_by: userId, created_at: now })
  }
  return clean
}

// Builds both drafts for a finished set. Safe to call again: the first call claims the set, later calls do nothing.
export async function ensureDrafts(db, setId) {
  const sets = db.collection('home_sets')
  const set = await sets.findOne({ _id: setId })
  if (!set || set.status !== 'active' || set.finished_at || set.soap_draft_id) return { created: false }
  const claim = await sets.updateOne({ _id: set._id, drafting: { $ne: true }, finished_at: null }, { $set: { drafting: true } })
  if (claim.modifiedCount !== 1) return { created: false }
  try {
    const stats = await buildSetStats(db, { patientId: set.patient_id, setParam: String(set._id) })
    if (!stats.selected?.finished) { await sets.updateOne({ _id: set._id }, { $set: { drafting: false } }); return { created: false } }
    const [patient, profile, played, published, employee] = await Promise.all([
      db.collection('patients').findOne({ _id: set.patient_id }, { projection: { first_name: 1, last_name: 1, nickname: 1, primary_condition: 1, condition: 1 } }),
      db.collection('pao_profiles').findOne({ patient_id: set.patient_id }),
      db.collection('game_sessions').distinct('game_id', { patient_id: set.patient_id, status: 'completed' }),
      db.collection('games').find({ status: 'published' }).toArray(),
      authorFor(db, set),
    ])
    if (!employee) throw new Error('No therapist is linked to this patient.')
    const first = patient?.nickname || patient?.first_name || 'the patient'
    const inSet = new Set(set.game_ids.map(String))
    const finished = stats.data.perGame.map((g) => ({ gameId: g.gameId, name: g.name, playList: g.playList, avg: g.home.accuracy != null ? Math.round(g.home.accuracy) : null }))
    const playDays = new Set(stats.data.accuracySeries.home.map((p) => p.date)).size
    const rec = recommend({ finished, candidates: published.filter((g) => !inSet.has(String(g._id))), playedIds: new Set(played.map(String)), stats: profile?.stats || null, first, setNumber: set.set_number, playDays })
    const low = lowestStat(profile?.stats || null)
    const { text, basedOn } = draftSections({ stats: { ...stats, lowest: low }, rec, first, setNumber: set.set_number })

    const noteId = new ObjectId()
    const clean = await writeSections(db, noteId, text, {
      kind: 'auto_draft',
      create: {
        appointment_id: null, employee_id: employee._id, employee_name: [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' '),
        patient_id: set.patient_id, patient_name: [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || null,
        diagnosis: String(patient?.primary_condition || patient?.condition || '').slice(0, 150) || null, title: null, session_date: manilaToday(), timezone: 'Asia/Manila',
        note_type: 'home_practice', home_set_id: set._id,
      },
    })
    const meta = { generatedAt: new Date(), history: [], sections: Object.fromEntries(SOAP_FIELDS.map((f) => [f, { source: 'auto', reviewed: false, basedOn: basedOn[f], autoHash: sha(clean[f]) }])) }
    await sets.updateOne({ _id: set._id }, { $set: { finished_at: new Date(), soap_draft_id: noteId, soap_meta: meta, recommendation: rec, objectives: rec.objectives, drafting: false, drafts_error: null } })
    await audit(db, { user: null, role: 'System', action: 'home_practice_draft_created', patientId: set.patient_id, noteId, meta: { set_id: String(set._id) } }).catch(() => {})
    if (employee.email) await notify(db, { email: employee.email, type: 'home_set_finished', title: `${first} finished Set ${set.set_number}`, body: 'Two drafts are ready: the SOAP note and the recommended next set. Review and approve them.', link: '/therapist/assign-games?tab=home', requestId: String(set._id) })
    return { created: true, noteId: String(noteId) }
  } catch (err) {
    console.error('ensureDrafts failed:', err)
    await sets.updateOne({ _id: set._id }, { $set: { drafting: false, drafts_error: String(err.message || err).slice(0, 200) } })
    return { created: false, error: err.message }
  }
}

// Called after a home play is saved: if that was the set's last play, prepare the drafts. Never throws.
export async function maybeFinishSet(db, patientId) {
  try {
    const set = await db.collection('home_sets').findOne({ patient_id: patientId, status: 'active' })
    if (!set || set.finished_at || set.soap_draft_id || set.use_at_home === false) return
    const m = await masteryForGames(db, patientId, set.game_ids, set.started_at, null, 'home')
    if (setIsComplete(set.game_ids.map((id) => m.get(String(id))))) await ensureDrafts(db, set._id)
  } catch (err) { console.error('maybeFinishSet failed:', err.message) }
}

async function setOfNote(db, noteId, { employee, assigned }) {
  const nid = toId(noteId)
  const note = nid && await db.collection('therapy_notes').findOne({ _id: nid, note_type: 'home_practice' })
  const set = note && await db.collection('home_sets').findOne({ soap_draft_id: note._id })
  if (!note || !set || !(String(note.employee_id) === String(employee._id) || await assigned(set.patient_id, employee._id))) throw httpError(404, 'That home practice note was not found.')
  return { note, set }
}

// What the Notes & Progress page needs around the draft: the set label, play scores, review state, which sections the therapist changed.
export async function noteContext(db, { noteId, employee, assigned }) {
  const { note, set } = await setOfNote(db, noteId, { employee, assigned })
  const stats = await buildSetStats(db, { patientId: set.patient_id, setParam: String(set._id) })
  const meta = set.soap_meta || { sections: {}, history: [] }
  const id = String(note._id)
  const sections = Object.fromEntries(SOAP_FIELDS.map((f) => {
    const m = meta.sections?.[f] || {}
    let edited = false
    try { edited = Boolean(note.status === 'draft' && m.autoHash && sha(cleanText(note[f] ? unescapeForHash(decryptField(note[f], id, f)) : '')) !== m.autoHash) } catch { edited = false }
    return [f, { reviewed: Boolean(m.reviewed), basedOn: m.basedOn || [], edited }]
  }))
  return {
    noteId: id, status: note.status, signedAt: note.signed_at || null, setId: String(set._id), setNumber: set.set_number,
    label: `Set ${set.set_number} · ${day(set.started_at)} – ${day(set.completed_at || stats.selected.endedAt || new Date())} · ${stats.data.perGame.map((g) => g.name).join(', ')}`,
    patientId: String(set.patient_id), diagnosis: note.diagnosis || '',
    sections, history: (meta.history || []).slice(-20).reverse(),
    scores: stats.data.perGame.map((g) => ({ name: g.name, plays: g.playList.map((p) => p.accuracy) })),
    nextSetNames: (set.recommendation?.games || []).map((g) => g.name), mark: SUBJECTIVE_MARK, locked: note.status === 'signed',
  }
}
// The stored text is HTML-escaped by cleanText; the hash was taken of the cleaned text, so compare cleaned text of the decrypted value.
const unescapeForHash = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

// Review ticks and edit history from the page. Only while the note is a draft.
export async function saveReview(db, { noteId, reviewed = {}, edited = [], employee, assigned }) {
  const { note, set } = await setOfNote(db, noteId, { employee, assigned })
  if (note.status !== 'draft') throw httpError(409, 'This note is already signed.', 'NOTE_ALREADY_SIGNED')
  const $set = {}
  for (const f of SOAP_FIELDS) if (typeof reviewed[f] === 'boolean') $set[`soap_meta.sections.${f}.reviewed`] = reviewed[f]
  for (const f of SOAP_FIELDS) if (edited.includes(f)) { $set[`soap_meta.sections.${f}.source`] = 'edited'; $set[`soap_meta.sections.${f}.reviewed`] = false }
  const ops = { ...(Object.keys($set).length ? { $set } : {}), ...(edited.length ? { $push: { 'soap_meta.history': { $each: [{ at: new Date(), sections: edited.filter((f) => SOAP_FIELDS.includes(f)) }], $slice: -50 } } } : {}) }
  if (Object.keys(ops).length) await db.collection('home_sets').updateOne({ _id: set._id }, ops)
  return { ok: true }
}

// "Redraft": writes the draft again from the data. Text the therapist changed is kept unless replaceEdits is true.
export async function redraft(db, { noteId, replaceEdits = false, employee, assigned, userId = null }) {
  const { note, set } = await setOfNote(db, noteId, { employee, assigned })
  if (note.status !== 'draft') throw httpError(409, 'This note is already signed.', 'NOTE_ALREADY_SIGNED')
  const stats = await buildSetStats(db, { patientId: set.patient_id, setParam: String(set._id) })
  const [patient, profile] = await Promise.all([db.collection('patients').findOne({ _id: set.patient_id }, { projection: { first_name: 1, nickname: 1 } }), db.collection('pao_profiles').findOne({ patient_id: set.patient_id })])
  const first = patient?.nickname || patient?.first_name || 'the patient'
  const rec = set.recommendation || { games: [], reviewGame: null }
  const { text, basedOn } = draftSections({ stats: { ...stats, lowest: lowestStat(profile?.stats || null) }, rec, first, setNumber: set.set_number })
  const id = String(note._id)
  const meta = set.soap_meta || { sections: {}, history: [] }
  const current = {}
  const out = {}
  for (const f of SOAP_FIELDS) {
    const stored = note[f] ? unescapeForHash(decryptField(note[f], id, f)) : ''
    current[f] = stored
    const wasEdited = meta.sections?.[f]?.autoHash && sha(cleanText(stored)) !== meta.sections[f].autoHash
    out[f] = wasEdited && !replaceEdits ? stored : text[f]
  }
  const clean = await writeSections(db, note._id, out, { kind: 'redraft', userId })
  const $set = {}
  for (const f of SOAP_FIELDS) {
    const kept = out[f] === current[f] && out[f] !== text[f]
    if (!kept) { $set[`soap_meta.sections.${f}`] = { source: 'auto', reviewed: false, basedOn: basedOn[f], autoHash: sha(clean[f]) } }
  }
  await db.collection('home_sets').updateOne({ _id: set._id }, { $set, $push: { 'soap_meta.history': { $each: [{ at: new Date(), sections: [], note: 'Redrafted from play data' }], $slice: -50 } } })
  return { text: out }
}

// Signing guard for the notes route: a home practice note needs the caregiver report written and every section reviewed.
export async function homeNoteSignBlock(db, note, value) {
  if (note.note_type !== 'home_practice') return null
  if (String(value.subjective || '').includes(SUBJECTIVE_MARK)) return 'Replace the highlighted placeholder in Subjective with the caregiver report before signing.'
  const set = await db.collection('home_sets').findOne({ soap_draft_id: note._id })
  const sections = set?.soap_meta?.sections || {}
  const left = SOAP_FIELDS.filter((f) => !sections[f]?.reviewed)
  if (left.length) return `Mark all four sections as reviewed before signing (${SOAP_FIELDS.length - left.length} of ${SOAP_FIELDS.length} done).`
  return null
}

// The recommended set with its reasons, for the "See why" view.
export async function recommendationFor(db, { setId, employee, assigned }) {
  const sid = toId(setId)
  const set = sid && await db.collection('home_sets').findOne({ _id: sid })
  if (!set || !(await assigned(set.patient_id, employee._id))) throw httpError(404, 'Set not found.')
  if (!set.recommendation) throw httpError(409, 'The drafts for this set are not ready yet.', 'SET_NOT_FINISHED')
  const signed = set.soap_draft_id ? await db.collection('therapy_notes').findOne({ _id: set.soap_draft_id, status: 'signed' }, { projection: { signed_at: 1 } }) : null
  return { setId: String(set._id), setNumber: set.set_number, recommendation: set.recommendation, objectives: set.objectives || set.recommendation.objectives, noteSigned: Boolean(signed), noteId: set.soap_draft_id ? String(set.soap_draft_id) : null }
}

// The therapist edits the objectives: the recommendation is re-run with them.
export async function updateObjectives(db, { setId, objectives, employee, assigned }) {
  const sid = toId(setId)
  const set = sid && await db.collection('home_sets').findOne({ _id: sid, status: 'active' })
  if (!set || !(await assigned(set.patient_id, employee._id))) throw httpError(404, 'Set not found.')
  if (!set.recommendation) throw httpError(409, 'The drafts for this set are not ready yet.', 'SET_NOT_FINISHED')
  const clean = (Array.isArray(objectives) ? objectives : []).slice(0, 8).map((o, i) => ({ id: String(o.id || `o-${i}`).slice(0, 40), text: cleanText(o.text || '').slice(0, 200), supports: Array.isArray(o.supports) ? o.supports.map(String).slice(0, 8) : [], stats: Array.isArray(o.stats) ? o.stats.map(String).slice(0, 6) : [], on: o.on !== false })).filter((o) => o.text)
  const stats = await buildSetStats(db, { patientId: set.patient_id, setParam: String(set._id) })
  const [patient, profile, played, published] = await Promise.all([
    db.collection('patients').findOne({ _id: set.patient_id }, { projection: { first_name: 1, nickname: 1 } }), db.collection('pao_profiles').findOne({ patient_id: set.patient_id }),
    db.collection('game_sessions').distinct('game_id', { patient_id: set.patient_id, status: 'completed' }), db.collection('games').find({ status: 'published' }).toArray(),
  ])
  const inSet = new Set(set.game_ids.map(String))
  const finished = stats.data.perGame.map((g) => ({ gameId: g.gameId, name: g.name, playList: g.playList, avg: g.home.accuracy != null ? Math.round(g.home.accuracy) : null }))
  const rec = recommend({ finished, candidates: published.filter((g) => !inSet.has(String(g._id))), playedIds: new Set(played.map(String)), stats: profile?.stats || null, first: patient?.nickname || patient?.first_name || 'the patient', objectives: clean, setNumber: set.set_number, playDays: new Set(stats.data.accuracySeries.home.map((p) => p.date)).size })
  await db.collection('home_sets').updateOne({ _id: set._id }, { $set: { recommendation: rec, objectives: rec.objectives } })
  return { recommendation: rec, objectives: rec.objectives }
}

