// GET /api/pao?patientEmail= -> Pao's profile, with `equipped` resolved to
// full item/hair docs (not just codes) so the avatar renderer has everything
// it needs in one call.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { serializePaoProfile } from '../serializePaoProfile.js'
import { serializePaoItem } from '../serializePaoItem.js'
import { serializePaoHair } from '../serializePaoHair.js'

const SLOTS = ['hair', 'hats', 'clothes', 'pants', 'shoes']

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientEmail = String(req.query.patientEmail || '').trim()

  const activitySessionId = String(req.query.activitySessionId || '').trim() || null
  if (!patientEmail && !activitySessionId) return res.status(400).json({ error: 'Missing patientEmail.' })

  try {
    await getMongo()
    const db = await getDb()
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patientId = resolved.patientId

    let profile = await PaoProfile.findOne({ patient_id: patientId })
    if (!profile) profile = await PaoProfile.create({ patient_id: patientId })

    const equipped = profile.equipped || {}
    const hairCode = equipped.hair
    const itemCodes = SLOTS.filter((s) => s !== 'hair').map((s) => equipped[s]).filter(Boolean)

    const [hairDoc, itemDocs] = await Promise.all([
      hairCode ? db.collection('pao_hair').findOne({ code: hairCode }) : null,
      itemCodes.length ? db.collection('clothes').find({ code: { $in: itemCodes } }).toArray() : [],
    ])
    const itemByCode = new Map(itemDocs.map((d) => [d.code, serializePaoItem(d)]))

    const equippedFull = {
      hair: hairDoc ? serializePaoHair(hairDoc) : null,
      hats: equipped.hats ? itemByCode.get(equipped.hats) || null : null,
      clothes: equipped.clothes ? itemByCode.get(equipped.clothes) || null : null,
      pants: equipped.pants ? itemByCode.get(equipped.pants) || null : null,
      shoes: equipped.shoes ? itemByCode.get(equipped.shoes) || null : null,
    }

    return res.status(200).json({ profile: { ...serializePaoProfile(profile), equipped: equippedFull } })
  } catch (err) {
    console.error('pao/profile error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the Pao profile.' })
  }
}
