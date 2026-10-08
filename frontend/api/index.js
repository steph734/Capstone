// Vercel's Hobby plan caps a deployment at 12 Serverless Functions, and this
// project outgrew that with one function per file under /api. This file is
// the ONLY function left — vercel.json rewrites every `/api/*` request to it
// (see the rewrite there for why: a `[...catchall].js` filename only matched
// a single path segment in Vercel's generated routing, so `/api/appointments/
// create` 404'd before reaching this file). The actual per-endpoint logic
// still lives in its own file under `_lib/routes/` (the leading underscore
// keeps `_lib` out of Vercel's function scan, same as the existing `_lib/`
// helpers), registered here as plain Express routes.
//
// Adding a new endpoint: drop a `_lib/routes/your-endpoint.js` exporting the
// same `(req, res) => {}` handler shape as before, then `app.all(...)` it
// below. No new file under /api, so no extra function.
import express from 'express'

import createPaymentIntent from './_lib/routes/create-payment-intent.js'
import createSetupIntent from './_lib/routes/create-setup-intent.js'
import createSubscription from './_lib/routes/create-subscription.js'
import paymentHistory from './_lib/routes/payment-history.js'
import resetPassword from './_lib/routes/reset-password.js'
import sendAppointmentConfirmation from './_lib/routes/send-appointment-confirmation.js'
import sendAppointmentSms from './_lib/routes/send-appointment-sms.js'
import sendReceipt from './_lib/routes/send-receipt.js'
import sendTrialReminder from './_lib/routes/send-trial-reminder.js'
import setDefaultPaymentMethod from './_lib/routes/set-default-payment-method.js'
import tts from './_lib/routes/tts.js'
import verifyCredentials from './_lib/routes/verify-credentials.js'
import appointmentsCreate from './_lib/routes/appointments-create.js'
import appointmentsRespond from './_lib/routes/appointments-respond.js'
import appointmentsAvailability from './_lib/routes/appointments-availability.js'
import appointmentsTherapists from './_lib/routes/appointments-therapists.js'
import appointmentsTherapistSlots from './_lib/routes/appointments-therapist-slots.js'
import appointmentsTherapistList from './_lib/routes/appointments-therapist-list.js'
import patientsTherapistList from './_lib/routes/patients-therapist-list.js'
import patientPhotosItem from './_lib/routes/patient-photos-item.js'
import authSignup from './_lib/routes/auth-signup.js'
import authVerifyOtp from './_lib/routes/auth-verify-otp.js'
import authResendOtp from './_lib/routes/auth-resend-otp.js'
import authLogin from './_lib/routes/auth-login.js'
import authChangePassword from './_lib/routes/auth-change-password.js'
import sendResetOtp from './_lib/routes/send-reset-otp.js'
import verifyResetOtp from './_lib/routes/verify-reset-otp.js'
import auditLogs from './_lib/routes/audit-logs.js'
import setPassword from './_lib/routes/set-password.js'
import attendanceScan from './_lib/routes/attendance-scan.js'
import attendanceMe from './_lib/routes/attendance-me.js'
import attendanceAvailability from './_lib/routes/attendance-availability.js'
import attendanceAvailabilityMonth from './_lib/routes/attendance-availability-month.js'
import attendanceLeaveRequests from './_lib/routes/attendance-leave-requests.js'
import attendanceRemind from './_lib/routes/attendance-remind.js'
import notesTherapistList from './_lib/routes/notes-therapist-list.js'
import notesPatientList from './_lib/routes/notes-patient-list.js'
import notesCreate from './_lib/routes/notes-create.js'
import notesShare from './_lib/routes/notes-share.js'
import exercisesTherapistList from './_lib/routes/exercises-therapist-list.js'
import exercisesCreate from './_lib/routes/exercises-create.js'
import exercisesDelete from './_lib/routes/exercises-delete.js'
import badgesList from './_lib/routes/badges-list.js'
import badgesCreate from './_lib/routes/badges-create.js'
import badgesItem from './_lib/routes/badges-item.js'
import paoItemsList from './_lib/routes/pao-items-list.js'
import paoItemsCreate from './_lib/routes/pao-items-create.js'
import paoItemsItem from './_lib/routes/pao-items-item.js'
import paoHairList from './_lib/routes/pao-hair-list.js'
import paoHairCreate from './_lib/routes/pao-hair-create.js'
import paoHairItem from './_lib/routes/pao-hair-item.js'
import paoThemesList from './_lib/routes/pao-themes-list.js'
import paoThemesItem from './_lib/routes/pao-themes-item.js'
import gamesList from './_lib/routes/games-list.js'
import gamesAdminList from './_lib/routes/games-admin-list.js'
import gamesAdminItem from './_lib/routes/games-admin-item.js'
import speechRecordingsCreate from './_lib/routes/speech-recordings-create.js'
import speechRecordingsList from './_lib/routes/speech-recordings-list.js'
import speechRecordingsItem from './_lib/routes/speech-recordings-item.js'
import speechRecordingsSummarize from './_lib/routes/speech-recordings-summarize.js'
import speechPhrasesCreate from './_lib/routes/speech-phrases-create.js'
import speechPhrasesList from './_lib/routes/speech-phrases-list.js'
import speechPhrasesItem from './_lib/routes/speech-phrases-item.js'
import speechMessagesCreate from './_lib/routes/speech-messages-create.js'
import speechMessagesList from './_lib/routes/speech-messages-list.js'
import speechMessagesItem from './_lib/routes/speech-messages-item.js'
import gameProgressComplete from './_lib/routes/game-progress-complete.js'
import gameProgressUnlocks from './_lib/routes/game-progress-unlocks.js'
import employeesCollection from './_lib/routes/employees-collection.js'
import employeesSendIdCard from './_lib/routes/employees-send-id-card.js'
import employeesApprove from './_lib/routes/employees-approve.js'
import employeesDocumentFile from './_lib/routes/employees-document-file.js'
import employeesPhoto from './_lib/routes/employees-photo.js'
import employeesItem from './_lib/routes/employees-item.js'
import branchesList from './_lib/routes/branches-list.js'
import paoProfile from './_lib/routes/pao-profile.js'
import paoBadges from './_lib/routes/pao-badges.js'
import paoWardrobe from './_lib/routes/pao-wardrobe.js'
import paoEquip from './_lib/routes/pao-equip.js'
import paoEquipTheme from './_lib/routes/pao-equip-theme.js'
import paoSeen from './_lib/routes/pao-seen.js'
import gameSessionsStart from './_lib/routes/game-sessions-start.js'
import gameSessionsAbandon from './_lib/routes/game-sessions-abandon.js'
import gameSessionsComplete from './_lib/routes/game-sessions-complete.js'
import gamesByName from './_lib/routes/games-by-name.js'
import activitiesPlayers from './_lib/routes/activities-players.js'
import activitiesSessionCurrent from './_lib/routes/activities-session-current.js'
import activitiesSessionStart from './_lib/routes/activities-session-start.js'
import activitiesSessionEnd from './_lib/routes/activities-session-end.js'

const app = express()

// Each handler reads `req.body` the way Vercel's built-in Node functions
// populated it — express.json() reproduces that for JSON requests.
// Default express.json() limit (100kb) is too small for a booking that
// includes a compressed profile photo (a base64 data URL, ~30-160KB) — see
// the photo upload box on step 1 of the booking form.
app.use(express.json({ limit: '3mb' }))

app.all('/api/create-payment-intent', createPaymentIntent)
app.all('/api/create-setup-intent', createSetupIntent)
app.all('/api/create-subscription', createSubscription)
app.all('/api/payment-history', paymentHistory)
app.all('/api/reset-password', resetPassword)
app.all('/api/send-appointment-confirmation', sendAppointmentConfirmation)
app.all('/api/send-appointment-sms', sendAppointmentSms)
app.all('/api/send-receipt', sendReceipt)
app.all('/api/send-trial-reminder', sendTrialReminder)
app.all('/api/set-default-payment-method', setDefaultPaymentMethod)
app.all('/api/tts', tts)
app.all('/api/verify-credentials', verifyCredentials)
app.all('/api/appointments/create', appointmentsCreate)
app.all('/api/appointments/:id/respond', appointmentsRespond)
app.all('/api/appointments/availability', appointmentsAvailability)
app.all('/api/appointments/therapists', appointmentsTherapists)
app.all('/api/appointments/therapist-slots', appointmentsTherapistSlots)
app.all('/api/appointments/therapist-list', appointmentsTherapistList)
app.all('/api/patients/therapist-list', patientsTherapistList)
app.all('/api/patient-photos/:publicId', patientPhotosItem)
app.all('/api/auth/signup', authSignup)
app.all('/api/auth/verify-otp', authVerifyOtp)
app.all('/api/auth/resend-otp', authResendOtp)
app.all('/api/auth/login', authLogin)
app.all('/api/auth/change-password', authChangePassword)
app.all('/api/auth/send-reset-otp', sendResetOtp)
app.all('/api/auth/verify-reset-otp', verifyResetOtp)
app.all('/api/audit-logs', auditLogs)
app.all('/api/set-password/:token', setPassword)
app.all('/api/attendance/scan', attendanceScan)
app.all('/api/attendance/me', attendanceMe)
app.all('/api/attendance/availability', attendanceAvailability)
app.all('/api/attendance/availability-month', attendanceAvailabilityMonth)
app.all('/api/attendance/leave-requests', attendanceLeaveRequests)
app.all('/api/attendance/remind', attendanceRemind)
app.all('/api/notes/therapist-list', notesTherapistList)
app.all('/api/notes/patient-list', notesPatientList)
app.all('/api/notes/create', notesCreate)
app.all('/api/notes/:id/share', notesShare)
app.all('/api/exercises/therapist-list', exercisesTherapistList)
app.all('/api/exercises/create', exercisesCreate)
app.all('/api/exercises/:id', exercisesDelete)
app.all('/api/badges/list', badgesList)
app.all('/api/badges/create', badgesCreate)
app.all('/api/badges/:id', badgesItem)
app.all('/api/pao-items/list', paoItemsList)
app.all('/api/pao-items/create', paoItemsCreate)
app.all('/api/pao-items/:id', paoItemsItem)
app.all('/api/pao-hair/list', paoHairList)
app.all('/api/pao-hair/create', paoHairCreate)
app.all('/api/pao-hair/:id', paoHairItem)
app.all('/api/pao-themes/list', paoThemesList)
app.all('/api/pao-themes/:code', paoThemesItem)
app.all('/api/games/list', gamesList)
app.all('/api/games/by-name', gamesByName) // must come before /api/games/:gameId, or "by-name" is read as an id
app.all('/api/games', gamesAdminList)
app.all('/api/games/:gameId', gamesAdminItem)
app.all('/api/speech-recordings/create', speechRecordingsCreate)
app.all('/api/speech-recordings/list', speechRecordingsList)
app.all('/api/speech-recordings/:id/summarize', speechRecordingsSummarize)
app.all('/api/speech-recordings/:id', speechRecordingsItem)
app.all('/api/speech-phrases/create', speechPhrasesCreate)
app.all('/api/speech-phrases/list', speechPhrasesList)
app.all('/api/speech-phrases/:id', speechPhrasesItem)
app.all('/api/speech-messages/create', speechMessagesCreate)
app.all('/api/speech-messages/list', speechMessagesList)
app.all('/api/speech-messages/:id', speechMessagesItem)
app.all('/api/game-progress/complete', gameProgressComplete)
app.all('/api/game-progress/unlocks', gameProgressUnlocks)

// More specific literal paths registered before the `:id` catch-all below,
// so e.g. POST /api/employees/send-id-card can't be swallowed by it.
app.all('/api/employees/send-id-card', employeesSendIdCard)
app.all('/api/employees/:id/approve', employeesApprove)
app.all('/api/employees/:id/documents/:key/file', employeesDocumentFile)
app.all('/api/employees/:id/photo', employeesPhoto)
app.all('/api/employees/:id', employeesItem)
app.all('/api/employees', employeesCollection)
app.all('/api/branches', branchesList)

// Pao progression (XP, levels, stats, badges, wardrobe unlocks).
app.all('/api/pao', paoProfile)
app.all('/api/pao/badges', paoBadges)
app.all('/api/pao/wardrobe', paoWardrobe)
app.all('/api/pao/equip', paoEquip)
app.all('/api/pao/equip-theme', paoEquipTheme)
app.all('/api/pao/seen', paoSeen)
app.all('/api/games/:gameId/sessions', gameSessionsStart)
app.all('/api/sessions/:id/abandon', gameSessionsAbandon)
app.all('/api/sessions/:id/complete', gameSessionsComplete)

// "Who is playing today?" activity sessions.
app.all('/api/activities/players', activitiesPlayers)
app.all('/api/activities/session/current', activitiesSessionCurrent)
app.all('/api/activities/session', activitiesSessionStart)
app.all('/api/activities/session/:id/end', activitiesSessionEnd)

app.use((req, res) => res.status(404).json({ error: 'Not found' }))

export default app
