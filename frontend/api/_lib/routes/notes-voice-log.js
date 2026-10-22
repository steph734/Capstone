// SOAP voice log (what was dictated or commanded while writing a note). Text only; audio is never stored.
//   GET  /api/notes/voice-access                          can this therapist use voice dictation? (plan check)
//   POST /api/notes/:noteId/voice-log                     { entries: [...] }  therapist, unsigned drafts only
//   GET  /api/notes/:noteId/voice-log?type=all|command|dictation
//   GET  /api/notes/:noteId/voice-log/export?format=pdf|csv|txt&commands=true&dictation=true
// There are no update or delete routes.
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { addEntries, listEntries, exportEntries, hasVoicePlan, rateLimit } from '../voiceLog.js'

const flag = (v, dflt = true) => (v === undefined ? dflt : String(v).toLowerCase() !== 'false')

export default async function handler(req, res) {
  const isAccess = req.path === '/api/notes/voice-access'
  const isExport = !isAccess && req.path.endsWith('/export')
  const noteId = req.params?.noteId

  try {
    await getMongo()

    if (isAccess) {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
      const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
      if (!ctx) return
      const allowed = await hasVoicePlan(ctx.db, ctx.user)
      res.setHeader('Cache-Control', 'no-store')
      return res.json(allowed ? { allowed: true } : { allowed: false, code: 'PLAN_REQUIRED', error: 'Voice dictation is available on Silver and Gold.' })
    }

    if (!ObjectId.isValid(noteId)) return res.status(400).json({ error: 'Invalid note id.' })

    // ── Add entries ──
    if (!isExport && req.method === 'POST') {
      const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
      if (!ctx) return
      const { db, user, ip } = ctx
      if (!rateLimit(res, `vl-post:${user._id}`, 60)) return
      if (!(await hasVoicePlan(db, user))) return res.status(403).json({ error: 'Voice dictation is available on Silver and Gold.', code: 'PLAN_REQUIRED' })
      const saved = await addEntries(db, user, noteId, req.body?.entries, ip)
      return res.status(201).json({ saved })
    }

    // ── Read / export (therapist, branch owner, super admin; never guardians) ──
    if (req.method !== 'GET') { res.setHeader('Allow', isExport ? 'GET' : 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }) }
    const ctx = await requireSession(req, res, { roles: ['Therapist', 'Owner', 'Super Admin', 'Patient'], auditDenied: true })
    if (!ctx) return
    const { db, user, ip } = ctx
    if (user.role === 'Patient') return res.status(403).json({ error: 'You do not have access to this voice log.' })

    if (isExport) {
      if (!rateLimit(res, `vl-export:${user._id}`, 10)) return
      const { body, filename, mime } = await exportEntries(db, user, noteId, {
        format: String(req.query.format || '').toLowerCase(), commands: flag(req.query.commands), dictation: flag(req.query.dictation), ip,
      })
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Cache-Control', 'no-store')
      return res.send(body)
    }

    const entries = await listEntries(db, user, noteId, { type: String(req.query.type || 'all'), ip })
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ entries })
  } catch (err) {
    // Never log request bodies or spoken text.
    console.error('notes voice-log error:', err.message)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.', ...(err.code ? { code: err.code } : {}) })
  }
}
