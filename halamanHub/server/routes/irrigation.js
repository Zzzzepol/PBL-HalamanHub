const express = require('express');
const { requireAuth } = require('../middleware/auth');
const IrrigationZone = require('../models/IrrigationZone');
const IrrigationSettings = require('../models/IrrigationSettings');
const IrrigationLog = require('../models/IrrigationLog');
const log = require('../utils/logger');

const router = express.Router();
router.use(requireAuth);

// ---- Zones ----

// GET /api/irrigation/zones
router.get('/zones', async (req, res) => {
  try {
    const zones = await IrrigationZone.find().sort({ zoneId: 1 });
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/irrigation/zones/:zoneId/toggle
router.patch('/zones/:zoneId/toggle', async (req, res) => {
  try {
    const zone = await IrrigationZone.findOne({ zoneId: req.params.zoneId });
    if (!zone) return res.status(404).json({ message: 'Zone not found.' });

    // ← Save the OLD status BEFORE changing it
    const wasActive = zone.status === 'active';

    if (wasActive) {
      zone.status = 'idle';
      zone.lastRunAt = new Date();
      zone.lastRunSummary = `Manually stopped at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      zone.status = 'active';
      zone.lastRunSummary = `Running since ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · 0 min elapsed`;
    }

    await zone.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `${wasActive ? 'Stopped' : 'Started'} irrigation for ${zone.name}`,
      category: 'irrigation',
    });

    res.json(zone);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---- Schedules ----

// ---- Settings (thresholds + mode) ----

// GET /api/irrigation/settings
router.get('/settings', async (req, res) => {
  try {
    let settings = await IrrigationSettings.findOne();
    if (!settings) settings = await IrrigationSettings.create({});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/irrigation/settings
router.put('/settings', async (req, res) => {
  try {
    let settings = await IrrigationSettings.findOne();
    if (!settings) settings = await IrrigationSettings.create({});

    const { moistureDryThreshold, moistureWetThreshold, mode, manualPump, manualSolenoid } = req.body;

if (moistureDryThreshold !== undefined) settings.moistureDryThreshold = moistureDryThreshold;
    if (moistureWetThreshold !== undefined) settings.moistureWetThreshold = moistureWetThreshold;
    if (mode !== undefined) settings.mode = mode;
    if (manualPump !== undefined) settings.manualPump = manualPump;
    if (manualSolenoid !== undefined) settings.manualSolenoid = manualSolenoid;

    const { tankEmptyDistanceCm, tankFullDistanceCm, tankLowThresholdPercent } = req.body;
    if (tankEmptyDistanceCm !== undefined) settings.tankEmptyDistanceCm = tankEmptyDistanceCm;
    if (tankFullDistanceCm !== undefined) settings.tankFullDistanceCm = tankFullDistanceCm;
    if (tankLowThresholdPercent !== undefined) settings.tankLowThresholdPercent = tankLowThresholdPercent;

    settings.updatedBy = req.user.name;

    await settings.save();

    await log({
      user: req.user.name,
      userId: req.user.id,
      action: `Updated irrigation settings (mode: ${settings.mode})`,
      category: 'irrigation',
    });

    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ---- Logs ----
// GET /api/irrigation/logs?limit=50&hours=24
router.get('/logs', async (req, res) => {
  try {
    const query = {};
    if (req.query.hours) {
      const hours = Math.min(Number(req.query.hours) || 24, 24 * 90);
      query.occurredAt = { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
    }
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const logs = await IrrigationLog.find(query).sort({ occurredAt: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;