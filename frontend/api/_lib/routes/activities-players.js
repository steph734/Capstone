// GET /api/activities/players?employeeEmail=&search=&sort=today|az|recent
// The "Who is playing today?" patient list. There's no dedicated
// patient-therapist assignment collection in this app — exactly like the
// Speech-to-Text "Who is this session for?" picker (patients-therapist-list.js),
// "this therapist's patients" is derived from who they actually have
// appointments with, via the `appointments` collection.
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { PaoProfile } from '../models/paoProfile.js'

function ageFromBirthdate(birthdate) {
  if (!birthdate) return null
  const now = new Date()
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const employeeEmail = String(req.query.employeeEmail || '').trim().toLowerCase()
  const search = String(req.query.search || '').trim()
  const sort = ['today', 'az', 'recent'].includes(req.query.sort) ? req.query.sort : 'today'
  if (!employeeEmail) return res.status(400).json({ error: 'Missing employeeEmail.' })

  try {
    await getMongo()
    const employee = await Employee.findOne({ email: employeeEmail }).lean()
    if (!employee) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    if (employee.status !== 'active') return res.status(403).json({ error: 'This staff account is not active.' })

    const db = await getDb()
    const todayIso = new Date().toISOString().slice(0, 10)

    const appts = await db.collection('appointments').aggregate([
      { $match: { employee_id: employee._id } },
      { $lookup: { from: 'patients', localField: 'patient_id', foreignField: '_id', as: 'patient' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: false } },
    ]).toArray()

    const byPatient = new Map()
    for (const a of appts) {
      const key = String(a.patient_id)
      if (!byPatient.has(key)) byPatient.set(key, { patient: a.patient, appts: [] })
      byPatient.get(key).appts.push(a)
    }

    let patients = Array.from(byPatient.values())

    if (search) {
      const re = new RegExp(escapeRegex(search), 'i')
      patients = patients.filter((p) => re.test(p.patient.first_name || '') || re.test(p.patient.last_name || '') || re.test(p.patient.nickname || ''))
    }

    const patientIds = patients.map((p) => p.patient._id)
    const profiles = patientIds.length ? await PaoProfile.find({ patient_id: { $in: patientIds } }).lean() : []
    const profileByPatient = new Map(profiles.map((p) => [String(p.patient_id), p]))

    const shaped = patients.map(({ patient: p, appts: a }) => {
      const todayAppt = a.find((x) => {
        const iso = x.session_date ? new Date(x.session_date).toISOString().slice(0, 10) : null
        return iso === todayIso && !x.is_archived
      })
      const profile = profileByPatient.get(String(p._id))
      const level = profile?.level ?? 1
      const xp = profile?.xp ?? 0
      const xpToNext = level >= 50 ? null : 100 + (level - 1) * 50
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ')
      const initials = [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join('').toUpperCase()

      return {
        id: String(p._id),
        displayName: p.nickname || p.first_name,
        fullName,
        initials: initials || '?',
        photoUrl: p.profile_photo?.url || null,
        age: ageFromBirthdate(p.birthdate),
        condition: p.primary_condition || null,
        hasAppointmentToday: !!todayAppt,
        appointmentId: todayAppt ? String(todayAppt._id) : null,
        pao: { level, xp, xpToNext },
        lastPlayedAt: profile?.last_played_at || null,
        voiceLanguage: profile?.voice_language || 'en',
      }
    })

    shaped.sort((a, b) => {
      if (sort === 'today') {
        if (a.hasAppointmentToday !== b.hasAppointmentToday) return a.hasAppointmentToday ? -1 : 1
        return a.fullName.localeCompare(b.fullName)
      }
      if (sort === 'recent') {
        if (!a.lastPlayedAt && !b.lastPlayedAt) return a.fullName.localeCompare(b.fullName)
        if (!a.lastPlayedAt) return 1
        if (!b.lastPlayedAt) return -1
        return new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt)
      }
      return a.fullName.localeCompare(b.fullName) // az
    })

    return res.status(200).json({ players: shaped })
  } catch (err) {
    console.error('activities/players error:', err)
    return res.status(500).json({ error: err.message || 'Could not load patients.' })
  }
}
