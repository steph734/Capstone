import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit, employeeFor } from '../noteAccess.js'
import { sendEmail } from '../brevo.js'
import { getStreamServerClient, upsertStreamUser, patientStreamId, therapistStreamId } from '../stream/serverClient.js'
import { canonicalPatientId } from '../stream/identity.js'
import {
  SESSION_TYPES, SESSION_MODES, SEND_VIA, RECOMMENDATION_TTL_MS, DEFAULT_SESSION_FEE,
  oid, esc, publicBase, notify, hasUpcoming, hasOpenRecommendation, expireStale,
  ensureRecommendationIndexes, serializeRecommendation,
} from '../sessionRecommendations.js'

// GET  /api/recommendations  -> this therapist's recommendations, newest first
// POST /api/recommendations  { appointmentId, sessionType, sessionMode, durationMinutes, message, sendVia }
//
// A therapist recommends another session after completing one. Saved as
// 'Sent' with a 3-day expiry, then delivered to the guardian by chat, email
// and/or an in-app notification.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    ensureRecommendationIndexes()
    const ctx = await requireSession(req, res, { roles: ['Therapist'] })
    if (!ctx) return
    const { db, user, ip } = ctx
    const employee = await employeeFor(db, user)
    if (!employee) return res.status(403).json({ error: 'No staff record is linked to this account.' })

    await expireStale(db).catch((err) => console.error('expireStale:', err.message))

    if (req.method === 'GET') {
      const rows = await db.collection('session_recommendations').find({ therapist_id: employee._id }).sort({ created_at: -1 }).limit(200).toArray()
      return res.status(200).json({ recommendations: rows.map((r) => serializeRecommendation(r)) })
    }

    // ── create ──
    const body = req.body || {}
    const appointmentId = oid(String(body.appointmentId || ''))
    const sessionType = String(body.sessionType || '')
    const sessionMode = String(body.sessionMode || '')
    const durationMinutes = Number(body.durationMinutes)
    const message = String(body.message || '').trim()
    const sendVia = [...new Set((Array.isArray(body.sendVia) ? body.sendVia : []).filter((v) => SEND_VIA.includes(v)))]

    if (!appointmentId) return res.status(400).json({ error: 'Choose the completed session to follow up on.' })
    if (!SESSION_TYPES.includes(sessionType)) return res.status(400).json({ error: 'Choose Cognitive, Speech or Occupational.' })
    if (!SESSION_MODES.includes(sessionMode)) return res.status(400).json({ error: 'Choose In-Person or Online.' })
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
      return res.status(400).json({ error: 'Choose a valid session duration.' })
    }
    if (!message) return res.status(400).json({ error: 'Write a short message to the parent.' })
    if (message.length > 1000) return res.status(400).json({ error: 'The message can be at most 1000 characters.' })
    if (!sendVia.length) return res.status(400).json({ error: 'Choose at least one way to send it (Chat, Email or In-app).' })

    const appt = await db.collection('appointments').findOne({ _id: appointmentId })
    if (!appt || !appt.employee_id || String(appt.employee_id) !== String(employee._id)) {
      return res.status(403).json({ error: 'You can only recommend a follow-up to your own sessions.' })
    }
    if (appt.status !== 'Completed') return res.status(409).json({ error: 'Mark the session as completed first.' })
    if (!appt.patient_id) return res.status(409).json({ error: 'This session has no patient record to recommend for.' })
    if (await hasOpenRecommendation(db, appt.patient_id)) {
      return res.status(409).json({ error: 'This patient already has an open session recommendation.' })
    }
    if (await hasUpcoming(db, appt.patient_id)) {
      return res.status(409).json({ error: 'This patient already has an upcoming appointment.' })
    }

    // The parent's login account (notifications, and the Stream chat identity, hang off it).
    let guardianUser = appt.booked_by ? await db.collection('users').findOne({ _id: appt.booked_by }, { projection: { email: 1, name: 1, full_name: 1 } }) : null
    if (!guardianUser && appt.contact_email) {
      guardianUser = await db.collection('users').findOne({ email: String(appt.contact_email).toLowerCase() }, { projection: { email: 1, name: 1, full_name: 1 } })
    }
    const guardianEmail = guardianUser?.email || appt.contact_email || null
    const therapistName = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'Your therapist'
    const therapistRole = employee.specialty || appt.therapist_role || ''
    const sessionFee = DEFAULT_SESSION_FEE

    const now = new Date()
    const ins = await db.collection('session_recommendations').insertOne({
      appointment_id: appointmentId, patient_id: appt.patient_id, therapist_id: employee._id,
      guardian_user_id: guardianUser?._id || null, session_type: sessionType, session_mode: sessionMode,
      duration_minutes: durationMinutes, session_fee: sessionFee, message, sent_via: sendVia,
      status: 'Sent', booked_appointment_id: null,
      expires_at: new Date(now.getTime() + RECOMMENDATION_TTL_MS), created_at: now, updated_at: now,
    })
    const recId = ins.insertedId
    const link = `/appointments/recommendation/${recId}`
    const firstName = String(appt.patient_name || 'your child').split(/\s+/)[0]
    const pickBy = new Date(now.getTime() + RECOMMENDATION_TTL_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

    const delivered = []
    const failed = {}

    if (sendVia.includes('in_app')) {
      if (guardianEmail) {
        await notify(db, {
          email: guardianEmail, type: 'session_recommendation', title: 'Another therapy session recommended',
          body: `${therapistName} recommends another session for ${firstName}. Pick a date by ${pickBy}.`, link, requestId: recId,
        })
        delivered.push('in_app')
      } else failed.in_app = 'No parent account found.'
    }

    if (sendVia.includes('email')) {
      try {
        if (!appt.contact_email && !guardianEmail) throw new Error('No parent email on file.')
        const to = appt.contact_email || guardianEmail
        const url = `${publicBase()}${link}`
        const greet = appt.guardian_name ? `Good day, ${esc(appt.guardian_name)}!` : 'Good day!'
        const html = `<!doctype html><html><body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;"><div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;overflow:hidden;">
<div style="background:#2c4a3e;color:#fff;padding:16px 24px;"><div style="font-size:18px;font-weight:700;">TherapyPro</div><div style="font-size:12px;opacity:.85;">${esc(firstName)}'s progress and next session</div></div>
<div style="padding:24px;"><p style="margin:0 0 12px;font-size:14px;">${greet}</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.55;">${esc(message)}</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.55;">${esc(therapistName)} recommends <b>another therapy session</b> (${esc(sessionType)} · ${esc(sessionMode)} · ${durationMinutes} min).</p>
<a href="${esc(url)}" style="display:block;text-align:center;background:#e0508f;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:10px;font-size:15px;">Set next therapy session</a>
<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#6b7c75;">Opens TherapyPro. Please pick a date by ${esc(pickBy)}.</p></div></div></div></body></html>`
        await sendEmail({
          to, toName: appt.guardian_name || undefined,
          subject: `${firstName}'s progress and next session`, html,
          plain: `${message}\n\n${therapistName} recommends another therapy session. Set it here: ${url}\nPlease pick a date by ${pickBy}.`,
        })
        delivered.push('email')
      } catch (err) {
        console.error('recommendation email failed:', err.message)
        failed.email = err.message
      }
    }

    if (sendVia.includes('chat')) {
      try {
        const client = getStreamServerClient()
        const therapistId = therapistStreamId(employee._id)
        const guardianId = patientStreamId(await canonicalPatientId(appt.patient_id))
        await upsertStreamUser(client, { id: therapistId, name: therapistName, image: employee.profile_picture?.url || undefined, appRole: 'therapist' })
        await upsertStreamUser(client, { id: guardianId, name: appt.guardian_name || appt.patient_name || 'Guardian', appRole: 'patient' })
        const channel = client.channel('messaging', { members: [therapistId, guardianId].sort(), created_by_id: therapistId })
        await channel.create()
        await channel.sendMessage({
          text: message,
          user_id: therapistId,
          attachments: [{
            type: 'session_recommendation',
            recommendation_id: String(recId),
            title: 'Another therapy session recommended',
            from: `${therapistName}${therapistRole ? `, ${therapistRole}` : ''}`,
            session_type: sessionType, session_mode: sessionMode, duration_minutes: durationMinutes,
            session_fee: sessionFee, expires_at: new Date(now.getTime() + RECOMMENDATION_TTL_MS).toISOString(), link,
          }],
        })
        delivered.push('chat')
      } catch (err) {
        console.error('recommendation chat failed:', err.message)
        failed.chat = err.message
      }
    }

    if (!delivered.length) {
      // Nothing reached the parent — don't leave an open recommendation that blocks a retry.
      await db.collection('session_recommendations').updateOne({ _id: recId }, { $set: { status: 'Cancelled', updated_at: new Date() } })
      return res.status(502).json({ error: `Could not send the recommendation: ${Object.values(failed).join(' ')}`, failed })
    }
    await db.collection('session_recommendations').updateOne({ _id: recId }, { $set: { sent_via: delivered, updated_at: new Date() } })

    await audit(db, { user, action: 'session_recommendation_sent', patientId: appt.patient_id, ip, meta: { recommendationId: String(recId), appointmentId: String(appointmentId), sentVia: delivered } })

    const saved = await db.collection('session_recommendations').findOne({ _id: recId })
    return res.status(201).json({ ok: true, recommendation: serializeRecommendation(saved), delivered, failed })
  } catch (err) {
    console.error('recommendations error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not process the recommendation.' })
  }
}
