import { getMongo } from '../mongo.js'
import { resolveCallerIdentity, therapistsForPatient, patientsForTherapist, canonicalPatientId } from '../stream/identity.js'

// GET /api/stream/contacts?email=...
// People this account is allowed to start a conversation with (used by the
// "compose" button on /messages). Patients see their therapist(s); therapists
// see their patients' guardians.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing email.' })

  try {
    await getMongo()
    const caller = await resolveCallerIdentity(email)
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

    if (caller.kind === 'therapist') {
      const patients = await patientsForTherapist(caller.employee._id)
      // One entry per guardian chat identity, even if they booked several times.
      const seen = new Set()
      const contacts = []
      for (const p of patients) {
        const canon = String(await canonicalPatientId(p.patientId))
        if (seen.has(canon)) continue
        seen.add(canon)
        contacts.push({ targetPatientId: String(p.patientId), name: `${p.guardianName} (guardian of ${p.patientName})` })
      }
      return res.status(200).json({ role: 'therapist', contacts })
    }

    const therapists = await therapistsForPatient(caller.patientIds)
    return res.status(200).json({
      role: 'patient',
      contacts: therapists.map((e) => ({
        targetEmployeeId: String(e._id),
        name: [e.first_name, e.last_name].filter(Boolean).join(' ') || 'Therapist',
      })),
    })
  } catch (err) {
    console.error('stream-contacts error:', err)
    return res.status(500).json({ error: err.message || 'Could not load contacts.' })
  }
}
