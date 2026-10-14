import { audit } from './noteAccess.js'

// Writes a Super Admin action to `audit_logs` (insert-only; throws if it
// cannot be recorded) and mirrors it into `auditlogs`, which feeds the Audit
// Logs page and the dashboard's recent activity.
export async function auditAdmin(ctx, action, description, meta = {}) {
  await audit(ctx.db, { user: ctx.user, action, ip: ctx.ip, meta })
  await ctx.db.collection('auditlogs').insertOne({
    user_id: ctx.user._id, action, ip_address: ctx.ip || 'unknown', description, created_at: new Date(),
  }).catch((err) => console.error('auditlogs mirror failed:', err.message))
}
