const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const MonitoringPlot = require('../models/MonitoringPlot');
const PlantProfile = require('../models/PlantProfile');
const SensorReading = require('../models/SensorReading');
const IrrigationSettings = require('../models/IrrigationSettings');
const { getPlantRecommendations } = require('../utils/soilRecommendations');
const { getMonitoringStation, setMonitoringStation } = require('../utils/monitoringStationState');
const { nameKey, ensureMonitoringPlots, addAssignment } = require('../utils/monitoringPlots');

const router = express.Router();
router.use(requireAuth);
const requireOperator = (req, res, next) => ['admin', 'staff'].includes(req.user?.role)
  ? next() : res.status(403).json({ message: 'This account cannot change growing areas.' });

async function selectedProfiles(ids) {
  const unique = Array.isArray(ids) ? [...new Set(ids.map(String))] : [];
  if (unique.some((id) => !mongoose.isValidObjectId(id))) return null;
  const profiles = unique.length
    ? await PlantProfile.find({ _id: { $in: unique } }).select('_id name').lean() : [];
  return profiles.length === unique.length ? profiles : null;
}

function readingQuery(plot) {
  const current = { plotId: plot._id };
  if (!plot.legacyKey || !plot.legacyLocation) return current;
  return { $or: [current, { plotId: null, monitoringLocation: plot.legacyLocation }] };
}

async function describePlot(plot, station) {
  const [latest, latestValid] = await Promise.all([
    SensorReading.findOne(readingQuery(plot)).sort({ recordedAt: -1 }).lean(),
    SensorReading.findOne({ ...readingQuery(plot), soilReadingValid: { $ne: false } }).sort({ recordedAt: -1 }).lean(),
  ]);
  const isActive = String(station.activePlotId) === String(plot._id);
  const isLive = Boolean(isActive && latest?.plotId && latest.soilReadingValid !== false
    && latest.recordedAt >= station.activeSince
    && Date.now() - new Date(latest.recordedAt).getTime() <= 15000
  );
  return {
    ...plot.toJSON(), isActive,
    isWateredArea: String(station.wateredPlotId) === String(plot._id),
    isLive, lastMeasuredAt: latestValid?.recordedAt || null,
    latestSoil: latestValid ? {
      moisture: latestValid.soilMoisture, ph: latestValid.ph, ec: latestValid.ec,
      nitrogen: latestValid.nitrogen, phosphorus: latestValid.phosphorus, potassium: latestValid.potassium,
      valid: true,
    } : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const { station, active } = await ensureMonitoringPlots();
    const profiles = active.plantProfileIds.length
      ? await PlantProfile.find({ _id: { $in: active.plantProfileIds } }).select('name').lean() : [];
    res.json({ ...station.toJSON(), monitoredPlants: profiles });
  } catch (error) {
    res.status(500).json({ message: 'Monitoring setup is not available right now.' });
  }
});

router.get('/plots', async (req, res) => {
  try {
    const { station, plots } = await ensureMonitoringPlots();
    res.json(await Promise.all(plots.map((plot) => describePlot(plot, station))));
  } catch (error) {
    res.status(500).json({ message: 'Growing areas are not available right now.' });
  }
});

router.post('/plots', requireOperator, async (req, res) => {
  try {
    await ensureMonitoringPlots();
    const name = String(req.body.name || '').trim().slice(0, 120);
    const profiles = await selectedProfiles(req.body.plantProfileIds);
    if (!name || !profiles) return res.status(400).json({ message: 'Enter an area name and choose valid plants.' });
    if (await MonitoringPlot.exists({ nameKey: nameKey(name) })) {
      return res.status(409).json({ message: 'An area with this name already exists.' });
    }
    const plot = await MonitoringPlot.create({ name, nameKey: nameKey(name), plantProfileIds: profiles.map((p) => p._id) });
    res.status(201).json(plot);
  } catch (error) {
    res.status(400).json({ message: 'We could not add this growing area.' });
  }
});

router.put('/plots/:id', requireOperator, async (req, res) => {
  try {
    const { station } = await ensureMonitoringPlots();
    const plot = mongoose.isValidObjectId(req.params.id) ? await MonitoringPlot.findById(req.params.id) : null;
    if (!plot) return res.status(404).json({ message: 'Growing area not found.' });
    const name = String(req.body.name || '').trim().slice(0, 120);
    const profiles = await selectedProfiles(req.body.plantProfileIds);
    if (!name || !profiles) return res.status(400).json({ message: 'Enter an area name and choose valid plants.' });
    if (await MonitoringPlot.exists({ nameKey: nameKey(name), _id: { $ne: plot._id } })) {
      return res.status(409).json({ message: 'An area with this name already exists.' });
    }
    plot.name = name;
    plot.nameKey = nameKey(name);
    plot.plantProfileIds = profiles.map((p) => p._id);
    await plot.save();
    if (String(station.activePlotId) === String(plot._id)) {
      station.location = plot.name;
      station.plantProfileIds = plot.plantProfileIds;
      await station.save();
      await addAssignment(plot);
      setMonitoringStation(station, profiles);
    }
    res.json(plot);
  } catch (error) {
    res.status(400).json({ message: 'We could not save this growing area.' });
  }
});

router.post('/plots/:id/activate', requireOperator, async (req, res) => {
  try {
    const { station } = await ensureMonitoringPlots();
    const plot = mongoose.isValidObjectId(req.params.id) ? await MonitoringPlot.findById(req.params.id) : null;
    if (!plot) return res.status(404).json({ message: 'Growing area not found.' });
    if (String(station.activePlotId) === String(plot._id)) return res.json({ activePlotId: plot._id });
    const [settings, latest] = await Promise.all([
      IrrigationSettings.findOne().lean(), SensorReading.findOne().sort({ recordedAt: -1 }).lean(),
    ]);
    const stoppedOnDevice = latest?.recordedAt
      && Date.now() - new Date(latest.recordedAt).getTime() <= 15000
      && latest.wateringEnabled === false && !latest.pumpActive && !latest.solenoidActive;
    if (settings?.wateringEnabled !== false || !stoppedOnDevice) {
      return res.status(409).json({ message: 'Turn off watering and wait for the ESP32 to confirm the pump and backup line are off before moving the probe.' });
    }
    const at = new Date();
    await addAssignment(plot, at);
    station.activePlotId = plot._id;
    station.activeSince = at;
    station.location = plot.name;
    station.plantProfileIds = plot.plantProfileIds;
    await station.save();
    const profiles = await PlantProfile.find({ _id: { $in: plot.plantProfileIds } }).select('name').lean();
    setMonitoringStation(station, profiles);
    res.json({ activePlotId: plot._id, activeSince: at });
  } catch (error) {
    res.status(400).json({ message: 'We could not move the probe assignment.' });
  }
});

router.get('/plots/:id', async (req, res) => {
  try {
    const { station } = await ensureMonitoringPlots();
    const plot = mongoose.isValidObjectId(req.params.id) ? await MonitoringPlot.findById(req.params.id) : null;
    if (!plot) return res.status(404).json({ message: 'Growing area not found.' });
    const [details, profiles] = await Promise.all([
      describePlot(plot, station),
      PlantProfile.find({ _id: { $in: plot.plantProfileIds } }).sort({ name: 1 }).lean(),
    ]);
    const values = details.latestSoil || {};
    res.json({ ...details, plantChecks: profiles.map((profile) => ({
      id: profile._id, name: profile.name, category: profile.category,
      checks: values.valid ? getPlantRecommendations({
        ph: values.ph, ec: values.ec, nitrogen: values.nitrogen,
        phosphorus: values.phosphorus, potassium: values.potassium,
        soilTargets: profile.soilTargets || {},
      }) : [],
    })) });
  } catch (error) {
    res.status(500).json({ message: 'Growing area details are not available right now.' });
  }
});

router.get('/plots/:id/readings', async (req, res) => {
  try {
    await ensureMonitoringPlots();
    const plot = mongoose.isValidObjectId(req.params.id) ? await MonitoringPlot.findById(req.params.id) : null;
    if (!plot) return res.status(404).json({ message: 'Growing area not found.' });
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const readings = await SensorReading.find(readingQuery(plot)).sort({ recordedAt: -1 }).limit(limit)
      .select('recordedAt soilMoisture ph ec nitrogen phosphorus potassium soilReadingValid').lean();
    res.json(readings);
  } catch (error) {
    res.status(500).json({ message: 'Growing area history is not available right now.' });
  }
});

// Existing clients can still read and edit the currently active area.
router.put('/', requireOperator, async (req, res) => {
  try {
    const { station, active } = await ensureMonitoringPlots();
    const name = String(req.body.location || active.name).trim().slice(0, 120);
    const profiles = await selectedProfiles(req.body.plantProfileIds);
    if (!name || !profiles) return res.status(400).json({ message: 'Choose an area and valid plant profiles.' });
    active.name = name;
    active.nameKey = nameKey(name);
    active.plantProfileIds = profiles.map((p) => p._id);
    await active.save();
    station.name = String(req.body.name || station.name).trim().slice(0, 80) || 'Main System';
    station.location = name;
    station.plantProfileIds = active.plantProfileIds;
    await station.save();
    await addAssignment(active);
    setMonitoringStation(station, profiles);
    res.json({ ...station.toJSON(), monitoredPlants: profiles });
  } catch (error) {
    res.status(400).json({ message: 'We could not save the monitoring setup.' });
  }
});

router.get('/live-summary', (req, res) => res.json(getMonitoringStation()));
module.exports = router;
