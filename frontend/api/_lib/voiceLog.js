// Voice log: what a therapist dictated or commanded while writing a SOAP note.
// Text only (audio is never recorded or uploaded). Entries live in `voice_logs`,
// are encrypted with the same AES-256-GCM helper as the note text, and are
// INSERT-ONLY: there is no update or delete anywhere in this module.
import { ObjectId, Int32, Double } from 'mongodb'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { encryptField, decryptField } from './soapCrypto.js'
import { employeeFor, audit } from './noteAccess.js'
import { loadPlansAndFeatures, loadSubscriptions, paidTierEmails } from './plans.js'

export const SECTIONS = ['subjective', 'objective', 'assessment', 'plan']
export const COMMANDS = ['next_section', 'previous_section', 'go_to_section', 'new_line', 'punctuation', 'undo', 'clear_section', 'read_back', 'save_draft', 'pause', 'stop_listening', 'sign_blocked']
export const LANGUAGES = ['en-US', 'fil-PH']
export const MAX_ENTRIES = 100
export const MAX_TEXT = 5000
const SECTION_LABEL = { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' }
const ENC_FIELD = 'voice_text' // bound (with the entry id) into the ciphertext

const httpError = (status, message, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) })
// eslint-disable-next-line no-control-regex
const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')

// ── Tiny per-user rate limiter (best effort: serverless containers keep their own memory) ──
const buckets = new Map()
export function rateLimit(res, key, max, windowMs = 60_000) {
  const now = Date.now()
  const b = buckets.get(key) || { n: 0, reset: now + windowMs }
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs }
  b.n += 1
  buckets.set(key, b)
  if (b.n > max) {
    res.setHeader('Retry-After', String(Math.ceil((b.reset - now) / 1000)))
    res.status(429).json({ error: 'Too many requests. Please slow down.' })
    return false
  }
  return true
}

// ── Plan gate: Silver or Gold ──────────────────────────────────────────────
// The app has no server-side plan record per clinic, so this accepts: the
// therapist (or a clinic Owner) being a beta tester on the Silver/Gold plan,
// or an active paid Silver/Gold subscription (Stripe) under the therapist's or
// an Owner's email. VOICE_LOG_REQUIRE_PLAN=false switches the check off (dev/demo).
const planCache = new Map()
export async function hasVoicePlan(db, user) {
  if (String(process.env.VOICE_LOG_REQUIRE_PLAN || '').trim().toLowerCase() === 'false') return true
  const key = String(user.email).toLowerCase()
  const hit = planCache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.ok

  const owners = (await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { email: 1 } }).toArray())
    .map((u) => String(u.email).toLowerCase())
  const emails = new Set([key, ...owners])
  const { plans } = await loadPlansAndFeatures(db)
  let ok = plans.some((p) => ['silver', 'gold'].includes(p.slug) && (p.beta_testers || []).some((e) => emails.has(String(e).toLowerCase())))
  if (!ok) {
    const subs = await loadSubscriptions()
    if (subs) {
      const paid = paidTierEmails(plans, subs)
      ok = [...emails].some((e) => paid.has(e))
    }
  }
  planCache.set(key, { ok, at: Date.now() })
  return ok
}

let indexesReady = false
async function ensureIndexes(db) {
  if (indexesReady) return
  const c = db.collection('voice_logs')
  await Promise.all([
    c.createIndex({ note_id: 1, spoken_at: 1 }),
    c.createIndex({ note_id: 1, type: 1 }),
    c.createIndex({ therapist_id: 1, created_at: -1 }),
  ]).catch((err) => console.error('voice_logs index create failed:', err.message))
  indexesReady = true
}

// ── Validation ─────────────────────────────────────────────────────────────
function validateEntry(raw, i) {
  const bad = (m) => httpError(400, `Entry ${i + 1}: ${m}`)
  if (!raw || typeof raw !== 'object') throw bad('invalid entry.')
  const type = raw.type
  if (type !== 'command' && type !== 'dictation') throw bad('type must be command or dictation.')
  const commandName = raw.command_name ?? null
  if (type === 'command' && commandName !== null && !COMMANDS.includes(commandName)) throw bad('unknown command.')
  if (type === 'dictation' && commandName !== null) throw bad('dictation cannot have a command name.')
  const section = raw.section ?? null
  if (section !== null && !SECTIONS.includes(section)) throw bad('unknown section.')
  const text = clean(raw.text).trim()
  if (!text) throw bad('text is required.')
  if (text.length > MAX_TEXT) throw bad(`text is longer than ${MAX_TEXT} characters.`)
  const result = raw.result == null ? null : clean(raw.result).trim().slice(0, 200) || null
  let confidence = null
  if (raw.confidence != null) {
    confidence = Number(raw.confidence)
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw bad('confidence must be between 0 and 1.')
  }
  if (!LANGUAGES.includes(raw.language)) throw bad('language must be en-US or fil-PH.')
  const sessionKey = String(raw.session_key ?? '')
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(sessionKey)) throw bad('invalid session key.')
  const spoken = new Date(raw.spoken_at)
  const now = Date.now()
  if (Number.isNaN(spoken.getTime()) || spoken.getTime() > now + 5 * 60_000 || spoken.getTime() < now - 7 * 24 * 3600_000) throw bad('invalid spoken_at.')
  return { type, commandName, section, text, result, confidence, language: raw.language, sessionKey, spoken }
}

// ── Note access ────────────────────────────────────────────────────────────
async function loadNote(db, noteId) {
  if (!ObjectId.isValid(noteId)) throw httpError(400, 'Invalid note id.')
  const note = await db.collection('therapy_notes').findOne({ _id: new ObjectId(String(noteId)), addendum_to: null })
  if (!note) throw httpError(404, 'Note not found.')
  return note
}

// Write access: only the note's own therapist, and only while it is an unsigned draft.
export async function addEntries(db, user, noteId, entries, ip) {
  if (!Array.isArray(entries) || entries.length === 0) throw httpError(400, 'No entries to save.')
  if (entries.length > MAX_ENTRIES) throw httpError(400, `Send at most ${MAX_ENTRIES} entries at a time.`)
  const note = await loadNote(db, noteId)
  const employee = await employeeFor(db, user)
  if (!employee || String(note.employee_id) !== String(employee._id)) throw httpError(403, 'Only the therapist who wrote this note can add to its voice log.')
  if (note.status === 'signed' || note.voided) throw httpError(409, 'This note is signed, so its voice log is closed.')

  const checked = entries.map(validateEntry)
  const now = new Date()
  const docs = checked.map((e) => {
    const _id = new ObjectId()
    const text = encryptField(e.text, String(_id), ENC_FIELD)
    if (text.length > 8000) throw httpError(400, 'An entry is too long to store.')
    return {
      _id,
      note_id: note._id,
      therapist_id: user._id, // from the session, never the request
      patient_id: note.patient_id,
      branch_id: employee.branch_id || null,
      type: e.type,
      command_name: e.type === 'command' ? e.commandName : null,
      section: e.section,
      text,
      result: e.result,
      char_count: new Int32(e.text.length),
      confidence: e.confidence == null ? null : new Double(e.confidence),
      language: e.language,
      session_key: e.sessionKey,
      spoken_at: e.spoken,
      created_at: now,
    }
  })

  await ensureIndexes(db)
  await db.collection('voice_logs').insertMany(docs, { ordered: true })
  await db.collection('therapy_notes').updateOne({ _id: note._id }, { $set: { voice_used: true }, $inc: { voice_log_count: docs.length } })
  // The audit trail records that voice was used, never what was said.
  await audit(db, { user, action: 'soap_voice_used', patientId: note.patient_id, noteId: note._id, ip, meta: { count: docs.length } })
  return docs.length
}

// Read/export access: the note's therapist, the owner of that branch, or a Super Admin.
async function assertCanRead(db, user, note) {
  if (user.role === 'Super Admin') return
  if (user.role === 'Therapist') {
    const employee = await employeeFor(db, user)
    if (employee && String(note.employee_id) === String(employee._id)) return
  }
  if (user.role === 'Owner') {
    const author = await db.collection('employees').findOne({ _id: note.employee_id }, { projection: { branch_id: 1 } })
    const branch = author?.branch_id ? await db.collection('branchs').findOne({ _id: author.branch_id }, { projection: { owner_id: 1 } }) : null
    // A branch with no owner assigned yet is open to Owner accounts (older data).
    if (!branch?.owner_id || String(branch.owner_id) === String(user._id)) return
  }
  throw httpError(403, 'You do not have access to this voice log.')
}

const toEntry = (d) => {
  let text
  try { text = decryptField(d.text, String(d._id), ENC_FIELD) ?? '' } catch { text = '[unreadable]' }
  return {
    time: d.spoken_at, type: d.type, commandName: d.command_name, section: d.section, text, result: d.result,
    charCount: d.char_count == null ? null : Number(d.char_count), confidence: d.confidence == null ? null : Number(d.confidence),
    language: d.language, sessionKey: d.session_key,
  }
}

export async function listEntries(db, user, noteId, { type = 'all' } = {}) {
  const note = await loadNote(db, noteId)
  await assertCanRead(db, user, note)
  const q = { note_id: note._id }
  if (type === 'command' || type === 'dictation') q.type = type
  const rows = await db.collection('voice_logs').find(q).sort({ spoken_at: 1, _id: 1 }).toArray()
  return rows.map(toEntry)
}

// ── Export ─────────────────────────────────────────────────────────────────
const TZ = 'Asia/Manila'
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const fmtStamp = (d) => new Date(d).toLocaleString('en-PH', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
const label = (e) => (e.type === 'command' ? 'Command' : 'Dictation')
const sec = (e) => SECTION_LABEL[e.section] || ''

function csvCell(v) {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // CSV injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildCsv(rows) {
  const head = ['time', 'type', 'section', 'command', 'text', 'result', 'language']
  const lines = [head, ...rows.map((e) => [fmtStamp(e.time), e.type, e.section || '', e.commandName || '', e.text, e.result || '', e.language])]
  return Buffer.from(`﻿${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`, 'utf8')
}

function buildTxt(rows) {
  const lines = rows.map((e) => {
    const where = sec(e) ? ` (${sec(e)})` : ''
    const tail = e.type === 'command' && e.result ? ` → ${e.result}` : ''
    return `[${fmtTime(e.time)}] ${label(e).toUpperCase()}${where} ${e.text}${tail}`
  })
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

function buildPdf(rows, meta) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setFillColor(44, 74, 62)
  doc.rect(0, 0, W, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('TherapyPro', 40, 38)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text('Voice log', W - 40, 38, { align: 'right' })
  doc.setTextColor(36, 53, 45); doc.setFontSize(11)
  const info = [['Patient', meta.patient], ['Diagnosis', meta.diagnosis || '—'], ['Session date', meta.sessionDate], ['Therapist', meta.therapist]]
  info.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, 40, 94 + i * 18)
    doc.setFont('helvetica', 'normal'); doc.text(String(v), 130, 94 + i * 18)
  })
  autoTable(doc, {
    startY: 94 + info.length * 18 + 10,
    head: [['Time', 'Type', 'Section', 'What was said', 'Result']],
    body: rows.map((e) => [fmtTime(e.time), label(e), sec(e) || '—', e.text, e.result || '']),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [44, 74, 62], textColor: 255 },
    columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 62 }, 2: { cellWidth: 68 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 110 } },
    margin: { left: 40, right: 40, bottom: 44 },
    didDrawPage: () => {
      doc.setFontSize(8); doc.setTextColor(107, 124, 117)
      doc.text(`Generated ${new Date().toLocaleDateString('en-PH', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' })} · Audio is not recorded`, 40, H - 22)
    },
  })
  return Buffer.from(doc.output('arraybuffer'))
}

const MIME = { pdf: 'application/pdf', csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8' }

export async function exportEntries(db, user, noteId, { format, commands, dictation, ip }) {
  if (!MIME[format]) throw httpError(400, 'format must be pdf, csv or txt.')
  if (!commands && !dictation) throw httpError(400, 'Include commands, dictated text, or both.')
  const note = await loadNote(db, noteId)
  await assertCanRead(db, user, note)
  const all = (await db.collection('voice_logs').find({ note_id: note._id }).sort({ spoken_at: 1, _id: 1 }).toArray()).map(toEntry)
  const rows = all.filter((e) => (e.type === 'command' ? commands : dictation))

  const patient = await db.collection('patients').findOne({ _id: note.patient_id }, { projection: { last_name: 1 } })
  const lastName = String(patient?.last_name || note.patient_name?.split(' ').slice(-1)[0] || 'patient')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'patient'
  const filename = `voice-log_${lastName}_${String(note.session_date).slice(0, 10)}.${format}`

  const body = format === 'csv' ? buildCsv(rows)
    : format === 'txt' ? buildTxt(rows)
      : buildPdf(rows, {
        patient: note.patient_name || 'Unknown', diagnosis: note.diagnosis, therapist: note.employee_name || '—',
        sessionDate: new Date(`${String(note.session_date).slice(0, 10)}T00:00:00+08:00`).toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' }),
      })
  await audit(db, { user, action: 'voice_log_exported', patientId: note.patient_id, noteId: note._id, ip, meta: { format } })
  return { body, filename, mime: MIME[format] }
}
