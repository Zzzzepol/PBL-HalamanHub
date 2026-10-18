const express = require('express');
const { requireAuth } = require('../middleware/auth');
const IrrigationZone = require('../models/IrrigationZone');
const IrrigationSettings = require('../models/IrrigationSettings');
const SensorReading = require('../models/SensorReading');
const IrrigationLog = require('../models/IrrigationLog');
const log = require('../utils/logger');
const { getLocalIrrigationSettings } = require('../utils/irrigationCloudSync');
const { requireShopDatabase } = require('../middleware/shopDatabase');
const MANUAL_CONTROL_LEASE_MS = 5 * 60 * 1000;
const DEVICE_ONLINE_WINDOW_MS = 15 * 1000;

const router = express.Router();
router.use(requireAuth);
const requireWateringOperator = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'This account can view readings but cannot change watering.' });
  }
  next();
};

// ---- Zones ----

// GET /api/irrigation/zones
router.get('/zones', requireShopDatabase, async (req, res) => {
  try {
    const zones = await IrrigationZone.find().sort({ zoneId: 1 });
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/irrigation/zones/:zoneId/toggle
router.patch('/zones/:zoneId/toggle', requireWateringOperator, requireShopDatabase, async (req, res) => {
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
    const settings = await getLocalIrrigationSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/irrigation/settings
router.put('/settings', requireWateringOperator, async (req, res) => {
  try {
    const settings = await getLocalIrrigationSettings();

    const { moistureDryThreshold, moistureWetThreshold, mode, manualPump, manualSolenoid, wateringEnabled } = req.body;

    if (mode !== undefined && !['auto', 'manual'].includes(mode)) {
      return res.status(400).json({ message: 'Choose Auto or Manual mode.' });
    }
    if (manualPump !== undefined && typeof manualPump !== 'boolean') {
      return res.status(400).json({ message: 'The water pump setting must be on or off.' });
    }
    if (manualSolenoid !== undefined && typeof manualSolenoid !== 'boolean') {
      return res.status(400).json({ message: 'The backup water line setting must be on or off.' });
    }
    if (wateringEnabled !== undefined && typeof wateringEnabled !== 'boolean') {
      return res.status(400).json({ message: 'The watering system setting must be on or off.' });
    }

    if (wateringEnabled !== undefined) {
      settings.wateringEnabled = wateringEnabled;
      if (!wateringEnabled) {
        settings.manualPump = false;
        settings.manualSolenoid = false;
        settings.manualControlExpiresAt = null;
      }
    }

    if (settings.wateringEnabled === false && (manualPump === true || manualSolenoid === true)) {
      return res.status(409).json({ message: 'Turn the watering system back on before enabling a water output.' });
    }

    if (moistureDryThreshold !== undefined) settings.moistureDryThreshold = moistureDryThreshold;
    if (moistureWetThreshold !== undefined) settings.moistureWetThreshold = moistureWetThreshold;
    if (!Number.isFinite(Number(settings.moistureDryThreshold))
        || !Number.isFinite(Number(settings.moistureWetThreshold))
        || settings.moistureDryThreshold < 0
        || settings.moistureDryThreshold >= settings.moistureWetThreshold
        || settings.moistureWetThreshold > 100) {
      return res.status(400).json({ message: 'Set the start wetness lower than the stop wetness.' });
    }
    if (mode !== undefined) settings.mode = mode;
    if (manualPump !== undefined) settings.manualPump = manualPump;
    if (manualSolenoid !== undefined) settings.manualSolenoid = manualSolenoid;

    if (mode === 'auto') {
      settings.manualPump = false;
      settings.manualSolenoid = false;
      settings.manualControlExpiresAt = null;
    } else if (manualPump === true || manualSolenoid === true) {
      const deviceIsOnline = settings.deviceLastSeenAt
        && Date.now() - settings.deviceLastSeenAt.getTime() <= DEVICE_ONLINE_WINDOW_MS;
      if (!deviceIsOnline || !settings.deviceBootId) {
        return res.status(409).json({ message: 'The ESP32 is not connected yet. Wait for a fresh sensor reading, then try again.' });
      }
      const latestReading = await SensorReading.findOne().sort({ recordedAt: -1 }).select('recordedAt tankReadingValid lockout').lean();
      const readingIsSafe = latestReading?.recordedAt
        && Date.now() - new Date(latestReading.recordedAt).getTime() <= DEVICE_ONLINE_WINDOW_MS
        && latestReading.tankReadingValid !== false
        && latestReading.lockout !== true;
      if (!readingIsSafe) {
        return res.status(409).json({ message: 'Manual watering needs a fresh tank reading and no safety pause.' });
      }
      if (settings.mode !== 'manual') {
        return res.status(409).json({ message: 'Choose Manual mode before turning on a water control.' });
      }
      settings.manualControlExpiresAt = new Date(Date.now() + MANUAL_CONTROL_LEASE_MS);
    } else if (!settings.manualPump && !settings.manualSolenoid) {
      settings.manualControlExpiresAt = null;
    }

    settings.settingsVersion = (settings.settingsVersion || 0) + 1;

    const { tankEmptyDistanceCm, tankFullDistanceCm, tankLowThresholdPercent } = req.body;
    if (tankEmptyDistanceCm !== undefined) settings.tankEmptyDistanceCm = tankEmptyDistanceCm;
    if (tankFullDistanceCm !== undefined) settings.tankFullDistanceCm = tankFullDistanceCm;
    if (tankLowThresholdPercent !== undefined) settings.tankLowThresholdPercent = tankLowThresholdPercent;
    if (!Number.isFinite(Number(settings.tankEmptyDistanceCm))
        || !Number.isFinite(Number(settings.tankFullDistanceCm))
        || settings.tankFullDistanceCm < 0
        || settings.tankEmptyDistanceCm <= settings.tankFullDistanceCm) {
      return res.status(400).json({ message: 'The empty-tank distance must be greater than the full-tank distance.' });
    }

    const { pumpOnTimeSec, soakTimeSec } = req.body;
    if (pumpOnTimeSec !== undefined) settings.pumpOnTimeSec = pumpOnTimeSec;
    if (soakTimeSec !== undefined) settings.soakTimeSec = soakTimeSec;

    settings.updatedBy = req.user.name;
    settings.bootstrapFromCloudPending = false;

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

// POST /api/irrigation/reset-lockout — one-shot command acknowledged by ESP32 telemetry.
router.post('/reset-lockout', requireWateringOperator, async (req, res) => {
  try {
    const current = await getLocalIrrigationSettings();
    const settings = await IrrigationSettings.findOneAndUpdate(
      { _id: current._id },
      { $inc: { lockoutResetVersion: 1, settingsVersion: 1 }, $set: { updatedBy: req.user.name, bootstrapFromCloudPending: false } },
      { new: true, runValidators: true }
    );
    await log({
      user: req.user.name,
      userId: req.user.id,
      action: 'Requested a watering safety reset',
      category: 'irrigation',
    });
    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: 'We could not request a safety reset. Please try again.' });
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
