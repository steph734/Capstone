const express = require('express');
const AuditLog = require('../models/AuditLog');
require('../models/User'); // registers the 'User' schema so populate() below works

const router = express.Router();

// GET /api/audit-logs — most recent security/audit events, for the
// Super Admin audit log page.
router.get('/', async (req, res) => {
  try {
    const logs = await AuditLog.find({})
      .sort({ created_at: -1 })
      .limit(200)
      .populate('user_id', 'full_name email role')
      .lean();

    const data = logs.map((log) => ({
      id: log._id.toString(),
      created_at: log.created_at,
      action: log.action,
      description: log.description,
      ip_address: log.ip_address,
      role: log.user_id?.role || 'System',
      user: log.user_id?.full_name || 'Unknown',
      email: log.user_id?.email || '—',
    }));

    return res.status(200).json({ success: true, logs: data });
  } catch (err) {
    console.error('audit-logs error:', err);
    return res.status(500).json({ error: 'Could not load audit logs.' });
  }
});

module.exports = router;
