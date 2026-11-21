import { auditAdmin } from './adminAudit.js'

// Records an admin-style action (created / edited / deleted a badge, hat, hairstyle ...) in the audit log from inside a
// route that apiGuard already protected (it puts the signed-in user on req.sessionCtx). A failed audit write is logged but
// never blocks the action itself.
export async function auditAction(req, action, description, meta = {}) {
  const ctx = req.sessionCtx
  if (!ctx) return
  try { await auditAdmin(ctx, action, description, meta) } catch (err) { console.error('audit failed:', err.message) }
}
