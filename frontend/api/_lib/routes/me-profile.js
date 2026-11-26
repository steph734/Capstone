// The signed-in person's own profile details (display name, photo and the other fields their profile page edits).
//   GET /api/me/profile   -> { profile }  ({} when nothing has been saved yet)
//   PUT /api/me/profile   -> { profile }  replaces the saved profile; also updates the account's display name
// Kept in its own `user_profiles` collection (one document per user), so the strict `users` collection and the
// login credentials are never touched. Who the caller is comes from the server session, never from the request.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

const TEXT_LIMITS = {
  name: 80, title: 120, phone: 40, dateOfBirth: 40, school: 120, guardian: 80,
  diagnosis: 120, therapist: 80, joined: 40, bio: 1000, email: 120,
}
const MAX_AVATAR_DATA_URL = 120000 // ~90 KB of image; the page resizes photos to about 256px first
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

function cleanProfile(body) {
  const src = body && typeof body === 'object' ? body : {}
  const out = {}
  const fields = {}
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const v = typeof src[key] === 'string' ? src[key].trim() : ''
    if (v.length > max) fields[key] = `Keep this under ${max} characters.`
    else if (v) out[key] = v // empty values are left out, never stored
  }
  if (!out.name && !fields.name) fields.name = 'Please enter your name.'
  if (typeof src.avatar === 'string' && src.avatar) {
    const a = src.avatar.trim()
    const ok = (/^https:\/\/\S{1,480}$/.test(a) || /^\/[\w./-]{1,200}$/.test(a))
      || (a.length <= MAX_AVATAR_DATA_URL && IMAGE_DATA_URL.test(a))
    if (!ok) fields.avatar = 'That photo could not be used. Choose a smaller JPG, PNG or WebP image.'
    else out.avatar = a
  }
  return { out, fields }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { idle: false })
    if (!ctx) return
    res.setHeader('Cache-Control', 'no-store')
    const col = ctx.db.collection('user_profiles')
    const userId = ctx.user._id

    if (req.method === 'GET') {
      const doc = await col.findOne({ user_id: userId })
      return res.status(200).json({ profile: doc?.profile || {} })
    }

    const { out, fields } = cleanProfile(req.body)
    if (Object.keys(fields).length) return res.status(422).json({ error: 'Please fix the highlighted fields.', fields })
    const now = new Date()
    await col.updateOne({ user_id: userId }, { $set: { profile: out, updated_at: now }, $setOnInsert: { created_at: now } }, { upsert: true })
    // The display name on the account follows the profile, so every page and every login shows the same name.
    await ctx.db.collection('users').updateOne({ _id: userId }, { $set: { full_name: out.name, updated_at: now } })
    return res.status(200).json({ profile: out })
  } catch (err) {
    console.error('me/profile error:', err.message)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save your profile.' })
  }
}
