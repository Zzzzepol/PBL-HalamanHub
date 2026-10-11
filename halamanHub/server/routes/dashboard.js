const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const IrrigationSettings = require('../models/IrrigationSettings');
const PlantProfile = require('../models/PlantProfile');
const MonitoringStation = require('../models/MonitoringStation');
const { getSoilRecommendations, getPlantRecommendations } = require('../utils/soilRecommendations');
const { getWaterQualityCategory, getPhStatus, getTankStatusInfo, getWaterQualityRecommendation } = require('../utils/waterQuality');

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
  const [sensors, latestReading, settings, station] = await Promise.all([
    Sensor.find().select('type zone status value numericValue').lean(),
    SensorReading.findOne()
      .sort({ recordedAt: -1 })
      .select('recordedAt tds tdsStable waterPh tankStatus pumpActive solenoidActive activeSource soilReadingValid tankReadingValid airReadingValid irrigationState irrigationCycle timeRemainingSec lockout deviceBootId appliedSettingsVersion appliedLockoutResetVersion deviceSequence bufferDroppedSamples bufferRestartLossCount monitoringStation monitoringLocation monitoredPlantNames')
      .lean(),
    IrrigationSettings.findOne().select('mode settingsVersion lockoutResetVersion deviceLastSeenAt').lean(),
    MonitoringStation.findOne({ key: 'main' }).lean(),
  ]);

  const readingAgeMs = latestReading?.recordedAt ? Date.now() - new Date(latestReading.recordedAt).getTime() : Infinity;
  const deviceOnline = settings?.deviceLastSeenAt && Date.now() - new Date(settings.deviceLastSeenAt).getTime() <= 15000;
  const sensorDataFresh = readingAgeMs <= 15000;
  const soilReadingFresh = deviceOnline && sensorDataFresh && latestReading?.soilReadingValid !== false;
  const tankReadingFresh = deviceOnline && sensorDataFresh && latestReading?.tankReadingValid !== false;
  const airReadingFresh = deviceOnline && sensorDataFresh && latestReading?.airReadingValid !== false;

  const profiles = station?.plantProfileIds?.length
    ? await PlantProfile.find({ _id: { $in: station.plantProfileIds } }).sort({ name: 1 }).lean()
    : [];

  const sensor = (type, zone) => sensors.find((item) => item.type === type && item.zone === zone);
  const activeSensors = sensors.filter((item) => item.status !== 'offline').length;
  const soilMoisture = sensor('Soil moisture', ZONE);
  const pH = sensor('pH', ZONE);
  const ec = sensor('EC', ZONE);
  const temperature = sensor('Temperature', ZONE);
  const humidity = sensor('Humidity', ZONE);
  const waterLevel = sensor('Water level', TANK_ZONE);
  const npk = sensor('NPK', ZONE);

  // Parse "N:60 P:38 K:67" into individual values
  let npkValues = { nitrogen: null, phosphorus: null, potassium: null };
  if (npk?.value && soilReadingFresh) {
    const match = npk.value.match(/N:(\d+)\s*P:(\d+)\s*K:(\d+)/);
    if (match) {
      npkValues = { nitrogen: Number(match[1]), phosphorus: Number(match[2]), potassium: Number(match[3]) };
    }
  }

  const recommendations = getSoilRecommendations({
    ph:          soilReadingFresh ? pH?.numericValue ?? null : null,
    ec:          soilReadingFresh ? ec?.numericValue ?? null : null,
    nitrogen:    npkValues.nitrogen,
    phosphorus:  npkValues.phosphorus,
    potassium:   npkValues.potassium,
    temperature: soilReadingFresh ? temperature?.numericValue ?? null : null,
    humidity:    airReadingFresh ? humidity?.numericValue ?? null : null,
  });

  const plantRecommendations = profiles.map((profile) => {
    const plantTargets = profile.soilTargets || { useDefault: true, npk: { nitrogen: null, phosphorus: null, potassium: null }, ec: null, ph: null };
    const list = getPlantRecommendations({
      ph:          soilReadingFresh ? pH?.numericValue ?? null : null,
      ec:          soilReadingFresh ? ec?.numericValue ?? null : null,
      nitrogen:    npkValues.nitrogen,
      phosphorus:  npkValues.phosphorus,
      potassium:   npkValues.potassium,
      temperature: soilReadingFresh ? temperature?.numericValue ?? null : null,
      humidity:    airReadingFresh ? humidity?.numericValue ?? null : null,
      soilTargets: plantTargets,
    });

    const high = list.some((item) => item.severity === 'high');
    const anyAction = list.some((item) => item.severity === 'high' || item.severity === 'medium');

    return {
      _id: profile._id,
      name: profile.name,
      category: profile.category,
      imageUrl: profile.imageUrl || '',
      sourceProductId: profile.sourceProductId || null,
      lastShopSyncAt: profile.lastShopSyncAt || null,
      soilTargets: plantTargets,
      status: high ? 'high' : anyAction ? 'medium' : 'ok',
      recommendations: list,
    };
  });

  res.json({
    monitoringStation: {
      name: station?.name || 'Main System',
      location: station?.location || '',
      monitoredPlants: profiles.map((profile) => ({ _id: profile._id, name: profile.name, category: profile.category })),
      usesSharedProbe: true,
    },
    sensorBufferDrops: latestReading?.bufferDroppedSamples ?? 0,
    sensorBufferRestartLosses: latestReading?.bufferRestartLossCount ?? 0,
    activeSensors,
    soilMoisture: { value: soilReadingFresh ? soilMoisture?.numericValue ?? null : null, unit: '%', status: soilReadingFresh ? soilMoisture?.status : deviceOnline ? 'warning' : 'offline' },
    pH: { value: soilReadingFresh ? pH?.numericValue ?? null : null, status: soilReadingFresh ? pH?.status : deviceOnline ? 'warning' : 'offline' },
    ec: { value: soilReadingFresh ? ec?.numericValue ?? null : null, unit: 'uS/cm', status: soilReadingFresh ? ec?.status : deviceOnline ? 'warning' : 'offline' },
    temperature: { value: soilReadingFresh ? temperature?.numericValue ?? null : null, unit: '°C', status: soilReadingFresh ? temperature?.status : deviceOnline ? 'warning' : 'offline' },
    humidity: { value: airReadingFresh ? humidity?.numericValue ?? null : null, unit: '%', status: airReadingFresh ? humidity?.status : deviceOnline ? 'warning' : 'offline' },
    waterTank: {
      available: tankReadingFresh && waterLevel?.status === 'ok',
      percent: tankReadingFresh ? waterLevel?.numericValue ?? null : null,
      raw: tankReadingFresh ? waterLevel?.value ?? null : null,
      status: tankReadingFresh ? waterLevel?.status ?? 'offline' : deviceOnline ? 'warning' : 'offline',
      // Rainwater Harvesting additions
      tds: deviceOnline ? latestReading?.tds ?? null : null,
      tdsStable: latestReading?.tdsStable ?? true,
      waterQuality: getWaterQualityCategory(deviceOnline ? latestReading?.tds ?? null : null),
      waterQualityRecommendation: getWaterQualityRecommendation(deviceOnline ? latestReading?.tds ?? null : null),
      waterPh: deviceOnline ? latestReading?.waterPh ?? null : null,
      waterPhStatus: getPhStatus(deviceOnline ? latestReading?.waterPh ?? null : null),
      tankStatus3: tankReadingFresh ? latestReading?.tankStatus ?? null : null,
      tankStatus3Info: getTankStatusInfo(tankReadingFresh ? latestReading?.tankStatus ?? null : null),
    },
    npk: { ...npkValues, status: soilReadingFresh ? npk?.status ?? 'offline' : deviceOnline ? 'warning' : 'offline' },
    recommendations,
    plantRecommendations,
    irrigation: {
      pumpActive: latestReading?.pumpActive ?? false,
      solenoidActive: latestReading?.solenoidActive ?? false,
      activeSource: latestReading?.activeSource ?? 'NONE',
      mode: settings?.mode ?? 'auto',
      lastUpdated: latestReading?.recordedAt ?? null,
      deviceOnline,
      deviceBootId: latestReading?.deviceBootId || '',
      readingAgeMs: Number.isFinite(readingAgeMs) ? readingAgeMs : null,
      deviceLastSeenAt: settings?.deviceLastSeenAt ?? null,
      deviceSequence: latestReading?.deviceSequence ?? null,
      bufferDroppedSamples: latestReading?.bufferDroppedSamples ?? 0,
      soilReadingFresh,
      tankReadingFresh,
      airReadingFresh,
      state: latestReading?.irrigationState ?? 'UNKNOWN',
      cycle: latestReading?.irrigationCycle ?? 0,
      timeRemainingSec: latestReading?.timeRemainingSec ?? 0,
      lockout: latestReading?.lockout ?? false,
      settingsVersion: settings?.settingsVersion ?? 1,
      appliedSettingsVersion: latestReading?.appliedSettingsVersion ?? 0,
      settingsApplied: deviceOnline && latestReading?.appliedSettingsVersion === (settings?.settingsVersion ?? 1),
      lockoutResetVersion: settings?.lockoutResetVersion ?? 0,
      appliedLockoutResetVersion: latestReading?.appliedLockoutResetVersion ?? 0,
      lockoutResetApplied: deviceOnline && latestReading?.appliedLockoutResetVersion === (settings?.lockoutResetVersion ?? 0),
    },
    lastUpdated: new Date().toISOString(),
  });
});

module.exports = router;
