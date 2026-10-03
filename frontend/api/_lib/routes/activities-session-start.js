// POST /api/activities/session
// body: { employeeEmail, patientId | null, mode, language, remember }
// Ends any session this therapist still had open (changed_player), then
// starts a new one. In patient mode, the patient must be someone this
// therapist actually has appointments with (same check the Speech-to-Text
// picker uses), and gets a pao_profile created if this is their first time.
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { ActivitySession } from '../models/activitySession.js'
import { PaoProfile } from '../models/paoProfile.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const employeeEmail = String(body.employeeEmail || '').trim().toLowerCase()
  const mode = body.mode === 'practice' ? 'practice' : 'patient'
  const language = ['en', 'tl', 'ceb'].includes(body.language) ? body.language : 'en'
  const remember = body.remember !== false
  const patientId = mode === 'patient' && mongoose.isValidObjectId(body.patientId) ? body.patientId : null

  if (!employeeEmail) return res.status(400).json({ error: 'Missing employeeEmail.' })
  if (mode === 'patient' && !patientId) return res.status(400).json({ error: 'Missing patientId.' })

  try {
    await getMongo()
    const employee = await Employee.findOne({ email: employeeEmail }).lean()
    if (!employee) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    if (employee.status !== 'active') return res.status(403).json({ error: 'This staff account is not active.' })

    const db = await getDb()
    let patient = null
    let appointmentId = null

    if (mode === 'patient') {
      patient = await db.collection('patients').findOne({ _id: new mongoose.Types.ObjectId(patientId) })
      if (!patient) return res.status(404).json({ error: 'Patient not found.' })

      const appt = await db.collection('appointments').findOne({ employee_id: employee._id, patient_id: patient._id })
      if (!appt) return res.status(403).json({ error: 'This patient is not assigned to you.' })

      const todayIso = new Date().toISOString().slice(0, 10)
      const todayAppt = await db.collection('appointments').findOne({
        employee_id: employee._id, patient_id: patient._id, is_archived: { $ne: true },
      })
      if (todayAppt && todayAppt.session_date && new Date(todayAppt.session_date).toISOString().slice(0, 10) === todayIso) {
        appointmentId = todayAppt._id
      }
    }

    // Only one active session per therapist — close whatever was open.
    await ActivitySession.updateMany(
      { therapist_id: employee._id, status: 'active' },
      { $set: { status: 'ended', ended_at: new Date(), end_reason: 'changed_player' } }
    )

    let profile = null
    if (patient) {
      profile = await PaoProfile.findOne({ patient_id: patient._id })
      if (!profile) profile = await PaoProfile.create({ patient_id: patient._id, voice_language: language })
      else if (profile.voice_language !== language) { profile.voice_language = language; await profile.save() }
    }

    const session = await ActivitySession.create({
      therapist_id: employee._id,
      branch_id: employee.branch_id,
      patient_id: patient ? patient._id : null,
      mode,
      language,
      remember,
      status: 'active',
      appointment_id: appointmentId,
      started_at: new Date(),
      last_active_at: new Date(),
    })

    const level = profile?.level ?? 1
    return res.status(201).json({
      session: {
        id: String(session._id),
        mode,
        remember,
        language,
        patient: patient ? {
          id: String(patient._id),
          displayName: patient.nickname || patient.first_name,
          fullName: [patient.first_name, patient.last_name].filter(Boolean).join(' '),
          email: patient.email || null,
          photoUrl: patient.profile_photo?.url || null,
          pao: { level, xp: profile?.xp ?? 0, xpToNext: level >= 50 ? null : 100 + (level - 1) * 50 },
        } : null,
      },
    })
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'You already have an active session. Please retry.' })
    }
    console.error('activities/session start error:', err)
    return res.status(500).json({ error: err.message || 'Could not start the session.' })
  }
}
