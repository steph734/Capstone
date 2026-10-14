// Pao FAQ bot API (signed-in users only; the role always comes from the
// server-side session, never from the client).
//   GET  /api/faq/quick            quick-question chips for the user's role (max 6)
//   POST /api/faq/ask  { text }    best answer / suggestions / none (+ suggest_ticket)
//   POST /api/faq/:id/feedback { helpful }   thumbs up / down, once per user per FAQ per session
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { BUG_WORDS, cleanStr, httpError, oidOrNull, rateLimit, supportRole } from '../support.js'

const shape = (f) => ({ id: String(f._id), question: f.question, answer: f.answer, link_label: f.link_label || null, link_path: f.link_path || null, category: f.category })

export default async function handler(req, res) {
  try {
    await getMongo()
    // Pao answers from the public help centre, so a session that went idle can still ask.
    const ctx = await requireSession(req, res, { roles: ['Owner', 'Therapist', 'Patient'], idle: false })
    if (!ctx) return
    const { db, user, session } = ctx
    const { faqRole } = supportRole(user)
    const faqs = db.collection('faqs')
    const path = req.path || ''

    if (req.method === 'GET' && path.endsWith('/quick')) {
      const rows = await faqs.find({ roles: faqRole, is_active: true, is_quick_question: true }).sort({ helpful_count: -1, question: 1 }).limit(6).toArray()
      return res.status(200).json({ quick: rows.map((f) => ({ id: String(f._id), question: f.question })) })
    }

    if (req.method === 'POST' && path.endsWith('/ask')) {
      const text = cleanStr(req.body?.text, 300)
      if (!text) return res.status(400).json({ error: 'Type a question first.' })
      if (!rateLimit(`ask:${user._id}`, 30, 60000)) return res.status(429).json({ error: 'You are asking very quickly. Please wait a moment.' })
      const suggestTicket = BUG_WORDS.test(text)
      const rows = await faqs.find({ $text: { $search: text }, roles: faqRole, is_active: true }, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } }).limit(3).toArray()
      if (rows.length === 0) {
        await db.collection('faq_misses').insertOne({ text, role: faqRole, user_id: user._id, created_at: new Date() }).catch(() => {})
        return res.status(200).json({ type: 'none', suggest_ticket: suggestTicket })
      }
      const [a, b] = rows
      // A clear winner: strong score and well ahead of the runner-up.
      if (a.score >= 1.2 && (!b || a.score >= b.score * 1.35)) return res.status(200).json({ type: 'answer', faq: shape(a), suggest_ticket: suggestTicket })
      return res.status(200).json({ type: 'suggestions', faqs: rows.map(shape), suggest_ticket: suggestTicket })
    }

    if (req.method === 'POST' && path.endsWith('/feedback')) {
      const id = oidOrNull(req.params?.id)
      if (!id) throw httpError(400, 'Invalid FAQ.')
      if (typeof req.body?.helpful !== 'boolean') throw httpError(400, 'Say whether it helped.')
      const helpful = req.body.helpful
      const faq = await faqs.findOne({ _id: id }, { projection: { _id: 1 } })
      if (!faq) throw httpError(404, 'FAQ not found.')
      // One vote per user per FAQ per login session; changing your vote moves it, it never double-counts.
      const fb = db.collection('faq_feedback')
      const prev = await fb.findOneAndUpdate({ faq_id: id, user_id: user._id, session_id: session._id }, { $set: { helpful, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } }, { upsert: true, returnDocument: 'before' })
      const before = prev && prev.value !== undefined ? prev.value : prev
      if (!before) await faqs.updateOne({ _id: id }, { $inc: helpful ? { helpful_count: 1 } : { not_helpful_count: 1 } })
      else if (before.helpful !== helpful) await faqs.updateOne({ _id: id }, { $inc: helpful ? { helpful_count: 1, not_helpful_count: -1 } : { helpful_count: -1, not_helpful_count: 1 } })
      return res.status(200).json({ ok: true })
    }

    return res.status(404).json({ error: 'Not found.' })
  } catch (err) {
    console.error('faq error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Pao could not answer right now.' })
  }
}
export { ObjectId }
