const mongoose = require('mongoose');

// Matches the `auditlogs` collection $jsonSchema validator in Atlas.
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
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
