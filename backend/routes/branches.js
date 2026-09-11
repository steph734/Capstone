const express = require('express');
const Branch = require('../models/Branch');

const router = express.Router();

// GET /api/branches -> active branches, for populating Branch dropdowns.
router.get('/', async (req, res) => {
  try {
    const branches = await Branch.find({ status: 'Active' }).sort({ branch_name: 1 }).lean();
    res.json({
      branches: branches.map((b) => ({ id: b._id.toString(), branch_name: b.branch_name })),
    });
  } catch (err) {
    console.error('list branches error:', err);
    res.status(500).json({ error: 'Could not load branches.' });
  }
});

module.exports = router;
