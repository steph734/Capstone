// POST /api/employees/send-id-card — emails a copy of a staff member's ID
// card (rendered client-side, since the card layout lives in canvas code on
// the owner dashboard) as a PDF attachment. Not tied to a specific employee
// id so it also works for demo/local-only staff rows that have no Mongo doc.
import multer from 'multer'
import { sendIdCardEmail } from '../employeeEmails.js'

const uploadIdCardPdfField = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
}).single('pdf')

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadIdCardPdfField(req, res, (err) => {
      if (!err) return resolve()
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'The ID card file is too large (max 5MB).' : 'Please attach a valid PDF file.'
      reject(Object.assign(new Error(message), { status: 400 }))
    })
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await runUpload(req, res)

    const email = String(req.body.email || '').trim().toLowerCase()
    const name = String(req.body.name || '').trim()
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'A valid staff email is required.' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No ID card PDF was attached.' })
    }
    await sendIdCardEmail({
      email,
      name,
      pdfBase64: req.file.buffer.toString('base64'),
      fileName: `${(name || 'staff').replace(/\s+/g, '_')}_ID_Card.pdf`,
    })
    return res.json({ success: true })
  } catch (err) {
    if (err?.status === 400) return res.status(400).json({ error: err.message })
    console.error('send id card email error:', err)
    return res.status(500).json({ error: err.message || 'Could not email the ID card.' })
  }
}
