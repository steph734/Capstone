// FAQ management for the Super Admin (Super Admin checked on the server).
//   GET    /api/admin/faqs?q=&role=&page=&limit=    table with helpful / not-helpful counts
//   POST   /api/admin/faqs                          create
//   PATCH  /api/admin/faqs/:id                      edit / toggle is_active
//   GET    /api/admin/faqs/misses                   unanswered questions (faq_misses), grouped by text
//   DELETE /api/admin/faqs/misses?text=             dismiss one unanswered question
import { Int32 } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { FAQ_CATEGORIES, FAQ_ROLES, cleanStr, httpError, oidOrNull, pick } from '../support.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Validates the editable fields; returns { value } or throws a 400 with field messages.
function parseFaq(body) {
  const fields = {}
  const question = cleanStr(body?.question, 200)
  const answer = cleanStr(body?.answer, 3000)
  if (!question) fields.question = 'Write the question.'
  if (!answer) fields.answer = 'Write the answer.'
  const roles = [...new Set((Array.isArray(body?.roles) ? body.roles : []).filter((r) => FAQ_ROLES.includes(r)))]
  if (!roles.length) fields.roles = 'Choose who sees this.'
  const category = pick(body?.category, FAQ_CATEGORIES, null)
  if (!category) fields.category = 'Choose a topic.'
  const keywords = [...new Set((Array.isArray(body?.keywords) ? body.keywords : String(body?.keywords || '').split(',')).map((k) => cleanStr(k, 40).toLowerCase()).filter(Boolean))].slice(0, 40)
  const link_path = cleanStr(body?.link_path, 200)
  // In-app pages only: a relative path, never a full URL.
  if (link_path && (!link_path.startsWith('/') || link_path.startsWith('//') || /^\/[a-z]+:/i.test(link_path))) fields.link_path = 'Use an in-app path such as /appointments.'
  const link_label = cleanStr(body?.link_label, 40)
  if (link_path && !link_label) fields.link_label = 'Add the button text.'
  if (Object.keys(fields).length) throw Object.assign(httpError(400, 'Please fix the highlighted fields.'), { fields })
  return { question, answer, roles, category, keywords, link_path: link_path || null, link_label: link_path ? link_label : null, is_quick_question: body?.is_quick_question === true, is_active: body?.is_active !== false }
}

export default async function handler(req, res) {
  const { id } = req.params || {}
  const isMisses = (req.path || '').endsWith('/misses')
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { db, user, ip } = ctx
    const faqs = db.collection('faqs')

    if (isMisses) {
      if (req.method === 'DELETE') {
        const text = cleanStr(req.query.text, 300)
        if (!text) throw httpError(400, 'Missing text.')
        await db.collection('faq_misses').deleteMany({ $expr: { $eq: [{ $toLower: '$text' }, text.toLowerCase()] } })
        return res.status(200).json({ ok: true })
      }
      const rows = await db.collection('faq_misses').aggregate([
        { $group: { _id: { $toLower: '$text' }, text: { $first: '$text' }, count: { $sum: 1 }, roles: { $addToSet: '$role' }, last: { $max: '$created_at' } } },
        { $sort: { count: -1, last: -1 } }, { $limit: 100 },
      ]).toArray()
      return res.status(200).json({ misses: rows.map((r) => ({ text: r.text, count: r.count, roles: r.roles, last_asked: r.last })) })
    }

    if (!id) {
      if (req.method === 'POST') {
        const v = parseFaq(req.body)
        const now = new Date()
        const { insertedId } = await faqs.insertOne({ ...v, helpful_count: new Int32(0), not_helpful_count: new Int32(0), faq_created_at: now, faq_updated_at: now })
        await audit(db, { user, action: 'faq_create', ip, meta: { faqId: String(insertedId), question: v.question } })
        return res.status(201).json({ id: String(insertedId) })
      }
      const q = cleanStr(req.query.q, 80)
      const role = pick(req.query.role, FAQ_ROLES, null)
      const match = {}
      if (role) match.roles = role
      if (q) match.$or = [{ question: { $regex: esc(q), $options: 'i' } }, { answer: { $regex: esc(q), $options: 'i' } }, { keywords: { $regex: esc(q.toLowerCase()) } }]
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
      const page = Math.max(1, Number(req.query.page) || 1)
      const [rows, total] = await Promise.all([faqs.find(match).sort({ faq_created_at: -1, question: 1 }).skip((page - 1) * limit).limit(limit).toArray(), faqs.countDocuments(match)])
      return res.status(200).json({ total, page, limit, faqs: rows.map((f) => ({ id: String(f._id), question: f.question, answer: f.answer, keywords: f.keywords || [], link_label: f.link_label || '', link_path: f.link_path || '', roles: f.roles, category: f.category, is_quick_question: !!f.is_quick_question, is_active: !!f.is_active, helpful_count: f.helpful_count || 0, not_helpful_count: f.not_helpful_count || 0, updated_at: f.faq_updated_at })) })
    }

    const fid = oidOrNull(id)
    if (!fid) throw httpError(400, 'Invalid FAQ id.')
    if (req.method === 'PATCH') {
      if (Object.keys(req.body || {}).length === 1 && typeof req.body.is_active === 'boolean') {
        await faqs.updateOne({ _id: fid }, { $set: { is_active: req.body.is_active, faq_updated_at: new Date() } })
        await audit(db, { user, action: req.body.is_active ? 'faq_enable' : 'faq_disable', ip, meta: { faqId: id } })
        return res.status(200).json({ ok: true })
      }
      const v = parseFaq(req.body)
      const r = await faqs.updateOne({ _id: fid }, { $set: { ...v, faq_updated_at: new Date() } })
      if (!r.matchedCount) throw httpError(404, 'FAQ not found.')
      await audit(db, { user, action: 'faq_update', ip, meta: { faqId: id, question: v.question } })
      return res.status(200).json({ ok: true })
    }
    throw httpError(405, 'Method not allowed')
  } catch (err) {
    console.error('admin/faqs error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.', fields: err.fields })
  }
}
