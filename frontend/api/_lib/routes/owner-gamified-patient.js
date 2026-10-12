// GET /api/owner/gamified/patients/:patientId?email=&range=7|30|90
// -> the per-patient stats dashboard for the clinic owner (read-only), plus
// the patient's therapist/branch and that branch's averages for the same
// period. Role is checked server-side.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { buildPatientStats } from '../gamifiedPatientStats.js'
import { requireOwner, loadRoster, branchAverages } from '../ownerGamified.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const patientId = String(req.params?.patientId || '')
  if (!mongoose.isValidObjectId(patientId)) return res.status(400).json({ error: 'Invalid patient id.' })
  const days = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30

  try {
    await getMongo()
    const ctx = await requireOwner(req, res)
    if (!ctx) return
    const pid = new mongoose.Types.ObjectId(patientId)

    const payload = await buildPatientStats(ctx.db, pid, days)
    if (!payload) return res.status(404).json({ error: 'Patient not found.' })

    const { roster } = await loadRoster(ctx.db)
    const me = roster.find((r) => r.id === patientId)
    const branch = me?.branchId ? { id: me.branchId, name: me.branchName, ...(await branchAverages(ctx.db, { branchId: me.branchId, days })) } : null

    return res.status(200).json({
      ...payload,
      therapist: me ? { id: me.therapistId, name: me.therapistName, email: me.therapistEmail } : null,
      branch,
    })
  } catch (err) {
    console.error('owner/gamified/patients/:id error:', err)
    return res.status(500).json({ error: err.message || 'Could not load this patient’s stats.' })
  }
}
