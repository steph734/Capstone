// GET /api/expenses/remind -> daily cron (see vercel.json): in-app notification + email to every Owner for each unpaid
// expense whose "remind me N days before due" day is today. Locked behind CRON_SECRET like /api/attendance/remind.
import { getMongo, getDb } from '../mongo.js'
import { COL, dateToDay } from '../finance.js'
import { dueReminders } from '../expensesCore.js'
import { sendEmail } from '../brevo.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const secret = process.env.CRON_SECRET
  if (!secret) { console.error('expenses/remind: CRON_SECRET is not set - refusing to run.'); return res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' }) }
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized.' })
  try {
    await getMongo()
    const db = await getDb()
    const owners = await db.collection(COL.users).find({ role: 'Owner', is_archived: { $ne: true }, email: { $type: 'string' } }, { projection: { email: 1, full_name: 1 } }).toArray()
    const result = await dueReminders(db, {
      onDue: async (x, days) => {
        const when = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`
        const total = (Number(x.total_amount) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })
        const title = `${x.vendor_name} is due ${when}`
        const body = `${x.reference_no} · PHP ${total} · due ${dateToDay(x.due_date)}`
        for (const o of owners) {
          await db.collection(COL.notifications).insertOne({ recipient_email: o.email.toLowerCase(), type: 'expense_due', title, body, link: '/owner/billing/expenses', read: false, created_at: new Date() })
          await sendEmail({ to: o.email, toName: o.full_name, subject: title, html: `<p>${title}.</p><p>${body}</p>`, plain: `${title}. ${body}` }).catch((e) => console.error('expense reminder email failed:', e.message))
        }
      },
    })
    return res.json({ ok: true, ...result })
  } catch (err) {
    console.error('expenses remind error:', err)
    return res.status(500).json({ error: 'Could not send expense reminders.' })
  }
}
