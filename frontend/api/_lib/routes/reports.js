// Reports API (therapist; owner and Super Admin may also pass ?therapistId=).
//   GET  /api/reports/:type?from=&to=&view=&patientId=&therapyType=&page=&q=&sort=   type = appointments | progress | sessions | exercises | attendance | games | patient
//        -> { kpis, charts, table: { rows, total, page, limit }, meta, ... }      cached 2 minutes per user + filters (not for `patient`)
//   GET  /api/reports/:type/rows?...   every row for exports (same filters, no paging)
//   GET  /api/reports/patients         -> [{ id, name }] for the Patient dropdown (only the caller's own patients for a therapist)
//   POST /api/reports/export-log       { type, format, filters, anonymized }  -> audit_logs row (no patient data)
//   PUT  /api/reports/remarks          { patientId, text }  -> therapist remarks saved with the individual patient report
// A therapist only ever sees their own patients; the scope is decided on the server.
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { allRows, buildEnv, runReport } from '../reports.js'

const ROLES = ['Therapist', 'Owner', 'Super Admin']
const TYPES = ['appointments', 'progress', 'sessions', 'exercises', 'attendance', 'games', 'patient']
const cache = new Map()
const TTL = 2 * 60 * 1000

export default async function handler(req, res) {
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ROLES })
    if (!ctx) return
    const { db } = ctx
    const type = req.params?.type
    const sub = req.params?.sub

    if (type === 'patients' && req.method === 'GET') {
      const env = await buildEnv(db, ctx, {})
      const list = env.scopePatientIds.map((id) => ({ id, name: env.nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name))
      return res.status(200).json({ patients: list })
    }

    if (type === 'export-log' && req.method === 'POST') {
      const b = req.body || {}
      await audit(db, {
        user: ctx.user, action: 'report_export', ip: ctx.ip,
        meta: { report: String(b.type || '').slice(0, 20), format: String(b.format || '').slice(0, 8), anonymized: Boolean(b.anonymized), filters: { from: b.filters?.from, to: b.filters?.to, view: b.filters?.view, therapyType: b.filters?.therapyType, patientFiltered: Boolean(b.filters?.patientId) } },
      })
      return res.status(200).json({ ok: true })
    }

    if (type === 'remarks' && req.method === 'PUT') {
      const { patientId, text } = req.body || {}
      if (!ObjectId.isValid(patientId)) return res.status(400).json({ error: 'Invalid patient.' })
      const env = await buildEnv(db, ctx, {})
      if (!env.scopePatientIds.includes(String(patientId))) return res.status(403).json({ error: 'That patient is not one of your patients.' })
      const clean = String(text || '').slice(0, 2000)
      await db.collection('report_remarks').updateOne({ patient_id: new ObjectId(patientId) }, { $set: { text: clean, updated_by: ctx.user._id, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } }, { upsert: true })
      return res.status(200).json({ ok: true, text: clean })
    }

    if (req.method !== 'GET' || !TYPES.includes(type)) return res.status(404).json({ error: 'Unknown report.' })
    const q = { ...req.query }
    const key = `${ctx.user._id}|${type}|${sub || ''}|${JSON.stringify(Object.keys(q).sort().map((k) => [k, q[k]]))}`
    if (!sub && type !== 'patient') { const hit = cache.get(key); if (hit && Date.now() - hit.at < TTL) return res.status(200).json(hit.data) }

    const env = await buildEnv(db, ctx, q)
    if (sub === 'rows') return res.status(200).json({ ...(await allRows(env, type)), therapist: env.therapistName, canSeeRevenue: env.canSeeRevenue })
    const data = await runReport(env, type)
    if (type !== 'patient') { cache.set(key, { at: Date.now(), data }); if (cache.size > 200) cache.delete(cache.keys().next().value) }
    return res.status(200).json(data)
  } catch (err) {
    console.error('reports failed:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not build this report.' })
  }
}
