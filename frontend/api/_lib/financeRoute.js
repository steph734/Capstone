// One wrapper for every Owner finance route: method check, session, role (Owner / Super Admin only), consistent errors.
import { getMongo } from './mongo.js'
import { requireSession } from './session.js'
import { FINANCE_ROLES, sendFinanceError } from './finance.js'

// handlers: { GET: async (ctx, req, res) => body | undefined, POST: ..., PATCH: ... }. A returned value is sent as JSON.
export function financeRoute(label, handlers) {
  return async function handler(req, res) {
    const fn = handlers[req.method]
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '))
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
    }
    try {
      await getMongo()
      const ctx = await requireSession(req, res, { roles: FINANCE_ROLES })
      if (!ctx) return // 401 / 403 already sent
      const out = await fn(ctx, req, res)
      if (out !== undefined && !res.headersSent) {
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(out.__status || 200).json(out.__status ? out.body : out)
      }
    } catch (err) {
      return sendFinanceError(res, err, label)
    }
  }
}
export const created = (body) => ({ __status: 201, body })
