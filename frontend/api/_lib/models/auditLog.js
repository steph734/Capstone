// ESM audit log model — mirrors backend/models/AuditLog.js. Matches the
// `auditlogs` collection's $jsonSchema validator in Atlas.
import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    ip_address: { type: String, required: true },
    description: { type: String, required: true },
    created_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'auditlogs',
    versionKey: false,
  }
)

// A warm serverless container re-imports this module across invocations but
// keeps the same Node process, so guard against "OverwriteModelError".
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
