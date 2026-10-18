
const express = require('express');
const { requireIotDevice } = require('../middleware/iotDevice');
const { getLocalIrrigationSettings } = require('../utils/irrigationCloudSync');
const MonitoringStation = require('../models/MonitoringStation');

const router = express.Router();

// GET /api/irrigation/control
router.get('/', requireIotDevice, async (req, res) => {
  try {
    const settings = await getLocalIrrigationSettings();
    const station = await MonitoringStation.findOne({ key: 'main' }).select('activePlotId wateredPlotId').lean();
    const probeAtWateredArea = Boolean(station?.activePlotId && station?.wateredPlotId
      && String(station.activePlotId) === String(station.wateredPlotId));
    if (settings.bootstrapFromCloudPending) {
      return res.status(503).json({ message: 'Review and save the local watering settings before sending them to the ESP32.' });
    }

    const bootId = String(req.get('x-device-boot-id') || '').slice(0, 80);
    let changed = false;
    if (bootId && bootId !== settings.deviceBootId) {
      // A manual command belongs to one ESP32 boot session. Never replay an
      // old pump-on command after a restart or when a device first reconnects.
      settings.deviceBootId = bootId;
      settings.manualPump = false;
      settings.manualSolenoid = false;
      settings.manualControlExpiresAt = null;
      settings.settingsVersion = (settings.settingsVersion || 0) + 1;
      changed = true;
    }

    if (settings.manualControlExpiresAt && settings.manualControlExpiresAt <= new Date()) {
      settings.manualPump = false;
      settings.manualSolenoid = false;
      settings.manualControlExpiresAt = null;
      settings.settingsVersion += 1;
      changed = true;
    }

    if (changed) await settings.save();

    res.json({
      serverTimeMs: Date.now(),
      mode: settings.mode,
      moistureDryThreshold: settings.moistureDryThreshold,
      moistureWetThreshold: settings.moistureWetThreshold,
      manualPump: probeAtWateredArea && settings.manualPump,
      manualSolenoid: probeAtWateredArea && settings.manualSolenoid,
      wateringEnabled: probeAtWateredArea && settings.wateringEnabled !== false,
      tankEmptyDistanceCm: settings.tankEmptyDistanceCm,
      tankFullDistanceCm: settings.tankFullDistanceCm,
      tankLowThresholdPercent: settings.tankLowThresholdPercent,
      pumpOnTimeSec: settings.pumpOnTimeSec,
      soakTimeSec: settings.soakTimeSec,
      manualControlExpiresAt: settings.manualControlExpiresAt,
      settingsVersion: settings.settingsVersion,
      lockoutResetVersion: settings.lockoutResetVersion,
      deviceBootId: settings.deviceBootId,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
