
const express = require('express');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const IrrigationLog = require('../models/IrrigationLog');
const IrrigationSettings = require('../models/IrrigationSettings');

const router = express.Router();

// Fallback thresholds — only used if IrrigationSettings hasn't been created yet
const DEFAULT_DRY = 30;
const DEFAULT_WET = 60;

// Fixed IDs for the single real ESP32 system (no zones — one physical unit)
const ZONE = 'Main System';
const TANK_ZONE = 'Tank 1';

async function upsertSensor(sensorId, type, zone, value, numericValue, device, status = 'ok') {
  await Sensor.findOneAndUpdate(
    { sensorId },
    { type, zone, value, numericValue, device, status, lastReadingAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

router.post('/', async (req, res) => {
  try {
    const { soil = {}, air = {}, watering = {}, device } = req.body;
    const deviceId = device || 'ESP32-01'; // current firmware doesn't send an ID yet — step 6 will add one

    const pumpActive     = watering.pumpActive === true;
    const solenoidActive = watering.solenoidActive === true;
    const waterAvailable = watering.tankWaterLevel === 'OK';
    const levelPercent    = watering.levelPercent;
    const distanceCm      = watering.distanceCm;

    // ---- 1. Update live snapshots (Dashboard / Sensors page) ----
    await Promise.all([
      upsertSensor('LIVE-001', 'Soil moisture', ZONE, `${soil.moisture ?? 0}%`, soil.moisture, deviceId),
      upsertSensor('LIVE-002', 'Temperature', ZONE, `${soil.temperature ?? 0}°C`, soil.temperature, deviceId),
      upsertSensor('LIVE-003', 'EC', ZONE, `${soil.ec ?? 0} uS/cm`, soil.ec, deviceId),
      upsertSensor('LIVE-004', 'pH', ZONE, `${soil.ph ?? 0}`, soil.ph, deviceId),
      upsertSensor('LIVE-005', 'NPK', ZONE, `N:${soil.nitrogen ?? 0} P:${soil.phosphorus ?? 0} K:${soil.potassium ?? 0}`, undefined, deviceId),
      upsertSensor('LIVE-006', 'Humidity', ZONE, `${air.humidity ?? 0}%`, air.humidity, deviceId),
      upsertSensor('LIVE-007', 'Water level', TANK_ZONE, `${levelPercent ?? 0}%`, levelPercent, deviceId, waterAvailable ? 'ok' : 'warning'),
    ]);

    // ---- 2. Save history record (Analytics charts) ----
    const previous = await SensorReading.findOne({ device: deviceId }).sort({ recordedAt: -1 });

    const reading = await SensorReading.create({
      device: deviceId,
      soilMoisture: soil.moisture,
      soilTemp: soil.temperature,
      ec: soil.ec,
      ph: soil.ph,
      nitrogen: soil.nitrogen,
      phosphorus: soil.phosphorus,
      potassium: soil.potassium,
      airTemp: air.temperature,
      airHumidity: air.humidity,
      distanceCm,
      levelPercent,
      waterAvailable,
      pumpActive,
      solenoidActive,
      activeSource: watering.activeSource || 'NONE',
    });

    // ---- 3. Detect state changes -> write IrrigationLog entries ----
    const settings = await IrrigationSettings.findOne();
    const dryThreshold = settings?.moistureDryThreshold ?? DEFAULT_DRY;
    const wetThreshold = settings?.moistureWetThreshold ?? DEFAULT_WET;
    const moisture = soil.moisture ?? null;

    const events = [];
    const prevPump = previous?.pumpActive ?? false;
    const prevSolenoid = previous?.solenoidActive ?? false;

    if (pumpActive !== prevPump) {
      let reason = 'manual';
      if (pumpActive && moisture !== null && moisture < dryThreshold) reason = 'auto_dry';
      if (!pumpActive && moisture !== null && moisture > wetThreshold) reason = 'auto_wet';
      if (!pumpActive && !waterAvailable) reason = 'safety_tank_empty';
      events.push({ source: 'PUMP', action: pumpActive ? 'ON' : 'OFF', reason });
    }

    if (solenoidActive !== prevSolenoid) {
      let reason = 'manual';
      if (solenoidActive && !waterAvailable && prevPump) reason = 'safety_tank_empty';
      else if (solenoidActive && moisture !== null && moisture < dryThreshold) reason = 'auto_dry';
      if (!solenoidActive && moisture !== null && moisture > wetThreshold) reason = 'auto_wet';
      events.push({ source: 'SOLENOID', action: solenoidActive ? 'ON' : 'OFF', reason });
    }

    if (events.length > 0) {
      await IrrigationLog.insertMany(
        events.map(e => ({ ...e, device: deviceId, moistureAtEvent: moisture }))
      );
    }

    res.status(201).json({ status: 'ok', readingId: reading._id });
  } catch (err) {
    console.error('Sensor ingestion error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;