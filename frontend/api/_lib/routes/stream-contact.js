import { getMongo, getDb } from '../mongo.js'
import { getStreamServerClient, upsertStreamUser, patientStreamId, therapistStreamId } from '../stream/serverClient.js'
import { resolveCallerIdentity, therapistsForPatient, patientsForTherapist } from '../stream/identity.js'

// POST /api/stream/contact  { email, targetPatientId? , targetEmployeeId? }
// Before a first chat/call, upserts the OTHER person in Stream — but only if
// the caller is actually allowed to reach them:
//   - a therapist may contact guardians of patients they've had an
//     appointment with (targetPatientId)
//   - a guardian/patient may contact a therapist they've had an appointment
//     with (targetEmployeeId)
// Returns a channel id both sides can open identically, plus the other
// person's display info so the UI doesn't need a second lookup.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.body?.email || '').trim().toLowerCase()
  const targetPatientId = req.body?.targetPatientId ? String(req.body.targetPatientId) : null
  const targetEmployeeId = req.body?.targetEmployeeId ? String(req.body.targetEmployeeId) : null

  if (!email) return res.status(400).json({ error: 'Missing email.' })
  if (!targetPatientId && !targetEmployeeId) {
    return res.status(400).json({ error: 'Missing targetPatientId or targetEmployeeId.' })
  }

  try {
    await getMongo()
    const caller = await resolveCallerIdentity(email)
    if (!caller) return res.status(404).json({ error: 'No TherapyPro account is linked to this email yet.' })

    let otherStreamId, otherName, otherImage, otherAppRole

    if (caller.kind === 'therapist' && targetPatientId) {
      const allowed = await patientsForTherapist(caller.employee._id)
      const match = allowed.find((p) => String(p.patientId) === targetPatientId)
      if (!match) return res.status(403).json({ error: "You don't have an appointment on record with this patient." })
      otherStreamId = patientStreamId(targetPatientId)
      otherName = match.guardianName
      otherAppRole = 'patient'
    } else if (caller.kind === 'patient' && targetEmployeeId) {
      const allowed = await therapistsForPatient(caller.patient._id)
      const match = allowed.find((e) => String(e._id) === targetEmployeeId)
      if (!match) return res.status(403).json({ error: "You don't have an appointment on record with this therapist." })
      otherStreamId = therapistStreamId(targetEmployeeId)
      otherName = [match.first_name, match.last_name].filter(Boolean).join(' ') || 'Therapist'
      otherImage = match.profile_picture?.url || null
      otherAppRole = 'therapist'
    } else {
      return res.status(403).json({ error: 'That contact is not allowed from this account.' })
    }

    const client = getStreamServerClient()
    await upsertStreamUser(client, { id: otherStreamId, name: otherName, image: otherImage, appRole: otherAppRole })

    const channel = client.channel('messaging', {
      members: [caller.streamId, otherStreamId].sort(),
      created_by_id: caller.streamId,
    })
    await channel.create()

    return res.status(200).json({
      channelType: 'messaging',
      channelId: channel.id,
      otherUser: { id: otherStreamId, name: otherName, image: otherImage || null },
    })
  } catch (err) {
    console.error('stream-contact error:', err)
    return res.status(500).json({ error: err.message || 'Could not start that conversation.' })
  }
}
