// POST /api/pao/equip-theme -> { patientEmail, themeCode }
// Wears the theme's set_items for every slot the patient has actually
// unlocked; leaves the rest as-is and reports which pieces are still locked.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { PatientUnlock } from '../models/patientUnlock.js'
import { resolvePatientId } from '../resolvePatient.js'
import { serializePaoProfile } from '../serializePaoProfile.js'

const SLOTS = ['hair', 'hats', 'clothes', 'pants', 'shoes']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const patientEmail = String(body.patientEmail || '').trim()
  const themeCode = String(body.themeCode || '').trim()
  if (!themeCode) return res.status(400).json({ error: 'Missing themeCode.' })

  try {
    await getMongo()
    const db = await getDb()
    const patientId = await resolvePatientId(patientEmail)
    if (!patientId) return res.status(404).json({ error: 'No patient record is linked to this account yet.' })

    const theme = await db.collection('pao_themes').findOne({ code: themeCode })
    if (!theme) return res.status(404).json({ error: 'Theme not found.' })

    const setItems = theme.set_items || {}
    const unlocks = await PatientUnlock.find({ patient_id: patientId }).lean()
    const unlockedSet = new Set(unlocks.map((u) => `${u.item_type}:${u.item_code}`))

    const $set = {}
    const locked = []
    for (const slot of SLOTS) {
      const code = setItems[slot]
      if (!code) continue
      const itemType = slot === 'hair' ? 'hair' : 'item'
      if (unlockedSet.has(`${itemType}:${code}`)) {
        $set[`equipped.${slot}`] = code
      } else {
        locked.push({ slot, code })
      }
    }

    const profile = await PaoProfile.findOneAndUpdate(
      { patient_id: patientId },
      Object.keys($set).length ? { $set } : {},
      { new: true, upsert: true }
    )

    return res.status(200).json({ profile: serializePaoProfile(profile), locked })
  } catch (err) {
    console.error('pao/equip-theme error:', err)
    return res.status(500).json({ error: err.message || 'Could not wear that theme.' })
  }
}
