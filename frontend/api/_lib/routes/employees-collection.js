// GET /api/employees -> list (newest first, branch + account status populated)
// POST /api/employees -> create a hire (User + Employee + GridFS documents)
//
// Ported from backend/routes/employees.js so the owner's Staff page works on
// the deployed Vercel site instead of only on a machine running that
// Express server locally (see http://localhost:5000 fallback bug).
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import multer from 'multer'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { Employee } from '../models/employee.js'
import { Branch } from '../models/branch.js'
import { sendApplicationReceivedEmail } from '../employeeEmails.js'

const DOC_KEYS = ['ptr', 'prc', 'diploma', 'id']
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])
const PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => cb(null, file.fieldname === 'photo' ? PHOTO_MIME.has(file.mimetype) : ALLOWED_MIME.has(file.mimetype)),
})
const uploadDocFields = upload.fields([
  ...DOC_KEYS.map((key) => ({ name: key, maxCount: 1 })),
  { name: 'photo', maxCount: 1 },
])

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadDocFields(req, res, (err) => {
      if (!err) return resolve()
      if (err instanceof multer.MulterError) {
        reject(Object.assign(new Error(err.code === 'LIMIT_FILE_SIZE' ? 'One of your files is too large (max 5MB each).' : `Upload error: ${err.message}`), { status: 400 }))
      } else {
        reject(Object.assign(new Error('Could not process the uploaded files.'), { status: 400 }))
      }
    })
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENDER_MAP = { Male: 'male', Female: 'female', 'Prefer not to say': 'prefer_not_to_say' }
// Atlas's `employees` collection validator requires these exact capitalized
// values for `employment_type` — must match, not the lowercase-hyphenated
// style used for `status`/`gender` below.
const EMPLOYMENT_MAP = { 'Full-time': 'Full-time', 'Part-time': 'Part-time', Contract: 'Contract', Locum: 'Locum' }

// "Jade Ann Dela Cruz Tan" -> { first_name: 'Jade', middle_name: 'Ann Dela Cruz', last_name: 'Tan' }
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: '', middle_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], middle_name: '', last_name: '' }
  if (parts.length === 2) return { first_name: parts[0], middle_name: '', last_name: parts[1] }
  return { first_name: parts[0], middle_name: parts.slice(1, -1).join(' '), last_name: parts[parts.length - 1] }
}

async function uniqueUsername(base) {
  const clean = (base || 'staff').replace(/[^a-z0-9._-]/gi, '') || 'staff'
  let candidate = clean
  let n = 1
  while (await User.exists({ username: candidate })) candidate = `${clean}${n++}`
  return candidate
}

async function handleList(req, res) {
  const employees = await Employee.find()
    .sort({ created_at: -1 })
    .populate('branch_id', 'branch_name')
    .populate('user_id', 'is_verified')
    .lean()
  return res.json({ employees })
}

async function handleCreate(req, res) {
  await runUpload(req, res)

  const body = req.body || {}
  const fullName = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const branchId = String(body.branchId || '').trim()
  const position = String(body.position || body.specialty || '').trim()
  const hiredAt = body.hiredAt ? new Date(body.hiredAt) : null
  const employeeId = String(body.employeeId || '').trim()

  if (!fullName || !email || !branchId || !position || !hiredAt || Number.isNaN(hiredAt.getTime()) || !employeeId) {
    return res.status(400).json({ error: 'Name, email, branch, position, hire date, and employee ID are required.' })
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }
  if (!mongoose.isValidObjectId(branchId)) {
    return res.status(400).json({ error: 'Invalid branch.' })
  }

  const branch = await Branch.findById(branchId).lean()
  if (!branch) return res.status(400).json({ error: 'That branch no longer exists.' })

  const clash = await User.findOne({ email }).lean()
  if (clash) return res.status(409).json({ error: 'That email is already registered.' })

  let user
  try {
    const username = await uniqueUsername(email.split('@')[0])
    // Staff sign in later via an invite/reset flow — this hash is never
    // handed out. Hashed with SHA-256 before bcrypt, same as every password
    // a browser sends us (login/signup/reset all pre-hash client-side).
    const tempPassword = crypto.randomBytes(12).toString('base64url')
    const tempPasswordDigest = crypto.createHash('sha256').update(tempPassword).digest('hex')
    const password_hash = await bcrypt.hash(tempPasswordDigest, 10)
    user = await User.create({
      full_name: fullName,
      username,
      email,
      role: 'Therapist',
      password: password_hash,
      is_verified: false,
      status: 'Active',
    })
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That email or username is already registered.' })
    }
    throw err
  }

  const { first_name, middle_name, last_name } = splitName(fullName)
  const doc = {
    user_id: user._id,
    branch_id: branch._id,
    first_name,
    middle_name,
    last_name,
    position,
    hired_at: hiredAt,
    email,
    status: 'for_review',
  }

  if (body.phoneCode && body.phone) doc.phone = { country_code: String(body.phoneCode), number: String(body.phone) }
  if (body.dob) {
    const d = new Date(body.dob)
    if (!Number.isNaN(d.getTime())) doc.dob = d
  }
  if (body.gender) doc.gender = GENDER_MAP[body.gender] || String(body.gender).toLowerCase()
  if (body.address) doc.address = String(body.address).trim()
  if (body.emergencyContact) doc.emergency_contact = String(body.emergencyContact).trim()
  if (body.emergencyCode && body.emergencyPhone) doc.emergency_phone = `${body.emergencyCode} ${body.emergencyPhone}`
  if (body.specialty) doc.specialty = String(body.specialty).trim()
  doc.employee_id = employeeId
  if (body.prcNumber) doc.prc_number = String(body.prcNumber).trim()
  if (body.experience !== undefined && body.experience !== '') {
    const n = Number(body.experience)
    if (!Number.isNaN(n)) doc.experience = n
  }
  if (body.employment) doc.employment_type = EMPLOYMENT_MAP[body.employment] || String(body.employment).toLowerCase()
  if (body.licenseExpiry) {
    const d = new Date(body.licenseExpiry)
    if (!Number.isNaN(d.getTime())) doc.license_expiry = d
  }

  const files = req.files || {}
  const missing = DOC_KEYS.filter((key) => !files[key]?.[0])
  if (missing.length) {
    await User.deleteOne({ _id: user._id }).catch(() => {})
    return res.status(400).json({ error: `Please upload PDF/JPG/PNG files (under 5MB) for: ${missing.join(', ')}.` })
  }

  let employee
  try {
    employee = await Employee.create(doc)
  } catch (err) {
    await User.deleteOne({ _id: user._id }).catch(() => {})
    throw err
  }

  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'staff_documents' })
    const documents = {}
    for (const key of DOC_KEYS) {
      const file = files[key][0]
      const fileId = new mongoose.Types.ObjectId()
      await new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStreamWithId(fileId, file.originalname, { metadata: { contentType: file.mimetype } })
        uploadStream.on('error', reject)
        uploadStream.on('finish', resolve)
        uploadStream.end(file.buffer)
      })
      documents[key] = fileId.toString()
    }
    employee.documents = documents

    const photoFile = files.photo?.[0]
    if (photoFile) {
      const photoFileId = new mongoose.Types.ObjectId()
      await new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStreamWithId(photoFileId, photoFile.originalname, { metadata: { contentType: photoFile.mimetype } })
        uploadStream.on('error', reject)
        uploadStream.on('finish', resolve)
        uploadStream.end(photoFile.buffer)
      })
      employee.profile_picture = {
        storage_key: photoFileId.toString(),
        url: `/api/employees/${employee._id}/photo`,
        uploaded_at: new Date(),
      }
    }

    await employee.save()
  } catch (err) {
    await Employee.deleteOne({ _id: employee._id }).catch(() => {})
    await User.deleteOne({ _id: user._id }).catch(() => {})
    console.error('upload employee documents error:', err)
    return res.status(500).json({ error: 'Could not save the uploaded documents. Please try again.' })
  }

  await User.updateOne({ _id: user._id }, { $set: { is_verified: true } })
  user.is_verified = true

  try {
    await sendApplicationReceivedEmail({ email, name: fullName })
  } catch (err) {
    console.error('send application received email error:', err)
  }

  return res.status(201).json({ success: true, employee, user: user.toSafeJSON() })
}

export default async function handler(req, res) {
  try {
    await getMongo()
    if (req.method === 'GET') return await handleList(req, res)
    if (req.method === 'POST') return await handleCreate(req, res)
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    if (err?.status === 400) return res.status(400).json({ error: err.message })
    console.error('employees collection error:', err)
    return res.status(500).json({ error: req.method === 'GET' ? 'Could not load employees.' : 'Could not save the employee record.' })
  }
}
