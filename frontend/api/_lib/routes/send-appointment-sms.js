import { sendAppointmentConfirmationSms } from '../appointmentSms.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone } = req.body || {}
  if (!phone) {
    return res.status(400).json({ error: 'Missing phone' })
  }

  try {
    const result = await sendAppointmentConfirmationSms(req.body || {})
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
