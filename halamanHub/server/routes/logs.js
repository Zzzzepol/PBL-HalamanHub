const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();
router.use(requireAuth);

// GET /api/logs
router.get('/', async (req, res) => {
  try {
    const limit    = Math.min(Number(req.query.limit) || 50, 200);
    const category = req.query.category;
    const filter   = category && category !== 'all' ? { category } : {};
    
    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;