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
import authSignup from './_lib/routes/auth-signup.js'
import authVerifyOtp from './_lib/routes/auth-verify-otp.js'
import authResendOtp from './_lib/routes/auth-resend-otp.js'
import authLogin from './_lib/routes/auth-login.js'
import sendResetOtp from './_lib/routes/send-reset-otp.js'
import verifyResetOtp from './_lib/routes/verify-reset-otp.js'

const app = express()

// Each handler reads `req.body` the way Vercel's built-in Node functions
// populated it — express.json() reproduces that for JSON requests.
app.use(express.json())

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
app.all('/api/auth/signup', authSignup)
app.all('/api/auth/verify-otp', authVerifyOtp)
app.all('/api/auth/resend-otp', authResendOtp)
app.all('/api/auth/login', authLogin)
app.all('/api/auth/send-reset-otp', sendResetOtp)
app.all('/api/auth/verify-reset-otp', verifyResetOtp)

app.use((req, res) => res.status(404).json({ error: 'Not found' }))

export default app
