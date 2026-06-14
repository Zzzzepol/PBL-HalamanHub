// ============================================================
// HalamanHub Server — Dashboard summary route
// Aggregates live data from MongoDB collections for the
// dashboard overview cards.
// ============================================================
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Sensor = require('../models/Sensor');
const IrrigationZone = require('../models/IrrigationZone');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/dashboard/summary
 * Returns a snapshot of key farm metrics derived from the
 * latest sensor readings and irrigation zone states.
 */
router.get('/summary', async (req, res) => {
  const [activeSensors, soilMoisture, pH, ec, temperature, humidity, waterLevel, npk, zones] = await Promise.all([
    Sensor.countDocuments({ status: { $ne: 'offline' } }),
    Sensor.findOne({ type: 'Soil moisture', zone: 'Zone A' }),
    Sensor.findOne({ type: 'pH', zone: 'Zone A' }),
    Sensor.findOne({ type: 'EC', zone: 'Zone A' }),
    Sensor.findOne({ type: 'Temperature', zone: 'Zone A' }),
    Sensor.findOne({ type: 'Humidity', zone: 'Zone A' }),
    Sensor.findOne({ type: 'Water level', zone: 'Tank 1' }),
    Sensor.findOne({ type: 'NPK', zone: 'Zone A' }),
    IrrigationZone.find(),
  ]);

  const irrigation = {};
  zones.forEach(z => { irrigation[z.zoneId.replace('-', '')] = z.status; });

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
    ec: { value: ec?.numericValue ?? null, unit: 'mS/cm', status: ec?.status },
    temperature: { value: temperature?.numericValue ?? null, unit: '°C', status: temperature?.status },
    humidity: { value: humidity?.numericValue ?? null, unit: '%', status: humidity?.status },
    waterTank: { value: waterLevel?.numericValue ?? null, unit: '%', litres: 984, capacity: 1200 },
    npk: npkValues,
    irrigation,
    lastUpdated: new Date().toISOString(),
  });
});

module.exports = router;
