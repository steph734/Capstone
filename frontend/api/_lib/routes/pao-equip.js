// PATCH /api/pao/equip -> { patientEmail, slot, code|null }
// Rejects locked codes and codes from the wrong category/slot.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { PatientUnlock } from '../models/patientUnlock.js'
import { resolvePatientId } from '../resolvePatient.js'
import { serializePaoProfile } from '../serializePaoProfile.js'

const SLOTS = ['hair', 'hats', 'clothes', 'pants', 'shoes']

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const patientEmail = String(body.patientEmail || '').trim()
  const slot = String(body.slot || '').trim()
  const code = body.code === null || body.code === undefined ? null : String(body.code).trim()

  if (!SLOTS.includes(slot)) return res.status(400).json({ error: 'Invalid slot.' })

  try {
    await getMongo()
    const db = await getDb()
    const patientId = await resolvePatientId(patientEmail)
    if (!patientId) return res.status(404).json({ error: 'No patient record is linked to this account yet.' })

    if (code) {
      const itemType = slot === 'hair' ? 'hair' : 'item'
      const doc = itemType === 'hair'
        ? await db.collection('pao_hair').findOne({ code })
        : await db.collection('clothes').findOne({ code, category: slot })
      if (!doc) return res.status(400).json({ error: 'That item does not exist for this slot.' })

      const unlocked = await PatientUnlock.findOne({ patient_id: patientId, item_type: itemType, item_code: code }).lean()
      if (!unlocked) return res.status(403).json({ error: 'That item is still locked.' })
    }

    const profile = await PaoProfile.findOneAndUpdate(
      { patient_id: patientId },
      { $set: { [`equipped.${slot}`]: code } },
      { new: true, upsert: true }
    )

    return res.status(200).json({ profile: serializePaoProfile(profile) })
  } catch (err) {
    console.error('pao/equip error:', err)
    return res.status(500).json({ error: err.message || 'Could not equip that item.' })
  }
}
