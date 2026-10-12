// POST /api/owner/gamified/notify  { email, branch?, therapist?, range? }
// -> emails each therapist their own "needs attention" patients. The list is
// recomputed server-side from the same filters (never taken from the client),
// and the caller's Owner role is checked.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { sendEmail } from '../brevo.js'
import { requireOwner, buildOverview } from '../ownerGamified.js'

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireOwner(req, res)
    if (!ctx) return
    const body = req.body || {}
    const days = [7, 30, 90].includes(Number(body.range)) ? Number(body.range) : 30
    const branchId = mongoose.isValidObjectId(body.branch) ? String(body.branch) : ''
    const therapistId = mongoose.isValidObjectId(body.therapist) ? String(body.therapist) : ''
    const overview = await buildOverview(ctx.db, { branchId, therapistId, days })

    const byTherapist = new Map()
    for (const n of overview.needsAttention) {
      if (!byTherapist.has(n.therapistId)) byTherapist.set(n.therapistId, { name: n.therapist, email: n.therapistEmail, items: [] })
      byTherapist.get(n.therapistId).items.push(n)
    }
    if (byTherapist.size === 0) return res.status(200).json({ sent: 0, skipped: 0, message: 'No patients need attention right now.' })

    let sent = 0, skipped = 0
    const failures = []
    for (const t of byTherapist.values()) {
      if (!t.email) { skipped += 1; continue }
      const rows = t.items.map((i) => `<li><strong>${esc(i.name)}</strong> — ${esc(i.chip)}: ${esc(i.detail)}</li>`).join('')
      try {
        await sendEmail({
          to: t.email, toName: t.name,
          subject: `${t.items.length} patient${t.items.length === 1 ? '' : 's'} could use a check-in`,
          html: `<div style="font-family:Arial,sans-serif;color:#2c4a3e"><p>Hi ${esc(t.name)},</p><p>The clinic owner flagged these patients from the Gamified Activities overview (last ${days} days):</p><ul>${rows}</ul><p style="color:#6b7c75;font-size:12px">Descriptive summary of recorded sessions. It does not diagnose or predict.</p></div>`,
          plain: `Hi ${t.name},\n\nPatients flagged from the Gamified Activities overview (last ${days} days):\n${t.items.map((i) => `- ${i.name} — ${i.chip}: ${i.detail}`).join('\n')}\n`,
        })
        sent += 1
      } catch (err) {
        console.error('owner notify email failed:', err)
        failures.push(t.name)
      }
    }
    if (sent === 0 && failures.length) return res.status(502).json({ error: `Could not send email (${failures.join(', ')}).` })
    return res.status(200).json({ sent, skipped, failed: failures.length })
  } catch (err) {
    console.error('owner/gamified/notify error:', err)
    return res.status(500).json({ error: err.message || 'Could not notify therapists.' })
  }
}
