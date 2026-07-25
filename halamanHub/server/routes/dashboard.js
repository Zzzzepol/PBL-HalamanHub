const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const IrrigationSettings = require('../models/IrrigationSettings');

const router = express.Router();
router.use(requireAuth);

// Your real hardware is one system, no zones — these match the
// zone names used by the sensor-data ingestion route.
const ZONE = 'Main System';
const TANK_ZONE = 'Tank 1';

/**
 * GET /api/dashboard/summary
 * Returns a snapshot of key farm metrics derived from the
 * latest sensor readings and the real irrigation system state.
 */
router.get('/summary', async (req, res) => {
  const [activeSensors, soilMoisture, pH, ec, temperature, humidity, waterLevel, npk, latestReading, settings] =
    await Promise.all([
      Sensor.countDocuments({ status: { $ne: 'offline' } }),
      Sensor.findOne({ type: 'Soil moisture', zone: ZONE }),
      Sensor.findOne({ type: 'pH', zone: ZONE }),
      Sensor.findOne({ type: 'EC', zone: ZONE }),
      Sensor.findOne({ type: 'Temperature', zone: ZONE }),
      Sensor.findOne({ type: 'Humidity', zone: ZONE }),
      Sensor.findOne({ type: 'Water level', zone: TANK_ZONE }),
      Sensor.findOne({ type: 'NPK', zone: ZONE }),
      SensorReading.findOne().sort({ recordedAt: -1 }),
      IrrigationSettings.findOne(),
    ]);

  // Parse "N:60 P:38 K:67" into individual values
  let npkValues = { nitrogen: null, phosphorus: null, potassium: null };
  if (npk?.value) {
    const match = npk.value.match(/N:(\d+)\s*P:(\d+)\s*K:(\d+)/);
    if (match) {
      npkValues = { nitrogen: Number(match[1]), phosphorus: Number(match[2]), potassium: Number(match[3]) };
    }
  }

  res.json({
    activeSensors,
    soilMoisture: { value: soilMoisture?.numericValue ?? null, unit: '%', status: soilMoisture?.status },
    pH: { value: pH?.numericValue ?? null, status: pH?.status },
    ec: { value: ec?.numericValue ?? null, unit: 'uS/cm', status: ec?.status },
    temperature: { value: temperature?.numericValue ?? null, unit: '°C', status: temperature?.status },
    humidity: { value: humidity?.numericValue ?? null, unit: '%', status: humidity?.status },
    waterTank: { available: waterLevel?.status === 'ok', percent: waterLevel?.numericValue ?? null },
    npk: npkValues,
    irrigation: {
      pumpActive: latestReading?.pumpActive ?? false,
      solenoidActive: latestReading?.solenoidActive ?? false,
      activeSource: latestReading?.activeSource ?? 'NONE',
      mode: settings?.mode ?? 'auto',
      lastUpdated: latestReading?.recordedAt ?? null,
    },
    lastUpdated: new Date().toISOString(),
  });
});

module.exports = router;