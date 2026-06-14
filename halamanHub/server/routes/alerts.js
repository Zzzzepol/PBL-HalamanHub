// ============================================================
// HalamanHub Server — Alert / notification routes
// ============================================================
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Alert = require('../models/Alert');

const router = express.Router();
router.use(requireAuth);

// GET /api/alerts
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const alerts = await Alert.find().sort({ occurredAt: -1 }).limit(limit);
  res.json(alerts);
});

// PATCH /api/alerts/:id/read
router.patch('/:id/read', async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  if (!alert) return res.status(404).json({ message: 'Alert not found.' });
  res.json(alert);
});

module.exports = router;
