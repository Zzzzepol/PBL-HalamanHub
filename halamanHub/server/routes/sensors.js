// ============================================================
// HalamanHub Server — Sensor routes
// ============================================================
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Sensor = require('../models/Sensor');

const router = express.Router();
router.use(requireAuth);

// GET /api/sensors
router.get('/', async (req, res) => {
  const sensors = await Sensor.find().sort({ sensorId: 1 });
  res.json(sensors);
});

// GET /api/sensors/summary — counts by status, for the sensors page header
router.get('/summary', async (req, res) => {
  const [ok, warning, offline, total] = await Promise.all([
    Sensor.countDocuments({ status: 'ok' }),
    Sensor.countDocuments({ status: 'warning' }),
    Sensor.countDocuments({ status: 'offline' }),
    Sensor.countDocuments(),
  ]);
  res.json({ ok, warning, offline, total });
});

// PATCH /api/sensors/:id — update reading (used by ESP32 ingestion in production)
router.patch('/:id', async (req, res) => {
  try {
    const { value, numericValue, status } = req.body;
    const update = { lastReadingAt: new Date() };
    if (value !== undefined) update.value = value;
    if (numericValue !== undefined) update.numericValue = numericValue;
    if (status !== undefined) update.status = status;

    const sensor = await Sensor.findOneAndUpdate({ sensorId: req.params.id }, update, { new: true });
    if (!sensor) return res.status(404).json({ message: 'Sensor not found.' });
    res.json(sensor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
