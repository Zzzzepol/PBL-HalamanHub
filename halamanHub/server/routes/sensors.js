const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const MonitoringPlot = require('../models/MonitoringPlot');

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

router.get('/locations', async (req, res) => {
  try {
    const locations = await SensorReading.distinct('monitoringLocation', { monitoringLocation: { $nin: ['', null] } });
    res.json(locations.filter(Boolean).sort((a, b) => a.localeCompare(b)));
  } catch (error) {
    res.status(500).json({ message: 'Monitoring areas are not available right now.' });
  }
});

// GET /api/sensors/history?hours=24 — averaged buckets across the full time range.
router.get('/history', async (req, res) => {
  try {
    const requestedHours = Number(req.query.hours) || 24;
    const hours = Math.max(1, Math.min(requestedHours, 24 * 30)); // cap at 30 days
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const location = String(req.query.location || '').trim().slice(0, 120);
    const plotId = String(req.query.plotId || '');
    const match = { recordedAt: { $gte: since } };
    if (plotId && !mongoose.isValidObjectId(plotId)) {
      return res.status(400).json({ message: 'Choose a valid growing area.' });
    }
    if (plotId) {
      const plot = await MonitoringPlot.findById(plotId).select('legacyKey legacyLocation').lean();
      if (!plot) return res.status(404).json({ message: 'Growing area not found.' });
      const current = { plotId: new mongoose.Types.ObjectId(plotId) };
      match.$or = plot.legacyKey === 'main' && plot.legacyLocation
        ? [current, { plotId: null, monitoringLocation: plot.legacyLocation }]
        : [current];
    } else if (location) match.monitoringLocation = location;
    const bucketCount = 600;
    const bucketMs = Math.max(2000, Math.floor((hours * 60 * 60 * 1000) / bucketCount));
    const readings = await SensorReading.aggregate([
      { $match: match },
      {
        $addFields: {
          historyBucket: {
            $toDate: {
              $multiply: [
                { $floor: { $divide: [{ $toLong: '$recordedAt' }, bucketMs] } },
                bucketMs,
              ],
            },
          },
        },
      },
      { $group: {
        _id: '$historyBucket',
        soilMoisture: { $avg: '$soilMoisture' },
        soilTemp: { $avg: '$soilTemp' },
        ec: { $avg: '$ec' },
        ph: { $avg: '$ph' },
        nitrogen: { $avg: '$nitrogen' },
        phosphorus: { $avg: '$phosphorus' },
        potassium: { $avg: '$potassium' },
        airTemp: { $avg: '$airTemp' },
        airHumidity: { $avg: '$airHumidity' },
        levelPercent: { $avg: '$levelPercent' },
        waterAvailableRatio: { $avg: { $cond: [{ $eq: ['$waterAvailable', true] }, 1, 0] } },
        sampleCount: { $sum: 1 },
      } },
      { $project: {
        _id: 0,
        recordedAt: '$_id',
        soilMoisture: 1,
        soilTemp: 1,
        ec: 1,
        ph: 1,
        nitrogen: 1,
        phosphorus: 1,
        potassium: 1,
        airTemp: 1,
        airHumidity: 1,
        levelPercent: 1,
        waterAvailable: { $gte: ['$waterAvailableRatio', 0.5] },
        sampleCount: 1,
      } },
      { $sort: { recordedAt: 1 } },
    ]);
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
