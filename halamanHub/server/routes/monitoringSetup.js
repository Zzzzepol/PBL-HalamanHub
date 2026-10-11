const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const MonitoringStation = require('../models/MonitoringStation');
const PlantProfile = require('../models/PlantProfile');
const { getMonitoringStation, setMonitoringStation } = require('../utils/monitoringStationState');

const router = express.Router();
router.use(requireAuth);

const CHECK_KEYS = ['probePlacement', 'readingsVerified', 'waterOutputsTested', 'autoCycleTested'];

async function loadStation() {
  const station = await MonitoringStation.getSingleton();
  const profiles = station.plantProfileIds?.length
    ? await PlantProfile.find({ _id: { $in: station.plantProfileIds } }).select('name').sort({ name: 1 }).lean()
    : [];
  setMonitoringStation(station, profiles);
  return { station, profiles };
}

router.get('/', async (req, res) => {
  try {
    const { station, profiles } = await loadStation();
    res.json({ ...station.toJSON(), monitoredPlants: profiles });
  } catch (error) {
    res.status(500).json({ message: 'Monitoring setup is not available right now.' });
  }
});

router.put('/', async (req, res) => {
  try {
    const name = String(req.body.name || 'Main System').trim().slice(0, 80) || 'Main System';
    const location = String(req.body.location || '').trim().slice(0, 120);
    const requestedIds = Array.isArray(req.body.plantProfileIds)
      ? [...new Set(req.body.plantProfileIds.map(String))]
      : [];
    if (requestedIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: 'Choose valid plant profiles.' });
    }
    const profiles = requestedIds.length
      ? await PlantProfile.find({ _id: { $in: requestedIds } }).select('_id name').lean()
      : [];
    if (profiles.length !== requestedIds.length) {
      return res.status(400).json({ message: 'One or more selected plant profiles are no longer available.' });
    }

    const station = await MonitoringStation.getSingleton();
    const scopeChanged = station.location !== location
      || [...(station.plantProfileIds || [])].map(String).sort().join('|') !== [...requestedIds].sort().join('|');
    station.name = name;
    station.location = location;
    station.plantProfileIds = requestedIds;
    if (scopeChanged) {
      station.checks.probePlacement = { checkedAt: null, checkedBy: '', notes: '' };
      station.checks.readingsVerified = { checkedAt: null, checkedBy: '', notes: '' };
    }
    await station.save();
    setMonitoringStation(station, profiles);
    res.json({ ...station.toJSON(), monitoredPlants: profiles });
  } catch (error) {
    res.status(400).json({ message: 'We could not save the monitoring setup.' });
  }
});

router.post('/checks/:checkKey', async (req, res) => {
  if (!CHECK_KEYS.includes(req.params.checkKey)) {
    return res.status(400).json({ message: 'Choose a valid setup check.' });
  }
  try {
    const station = await MonitoringStation.getSingleton();
    station.checks[req.params.checkKey] = {
      checkedAt: new Date(),
      checkedBy: req.user.name || 'Staff',
      notes: String(req.body.notes || '').trim().slice(0, 500),
    };
    await station.save();
    const profiles = station.plantProfileIds?.length
      ? await PlantProfile.find({ _id: { $in: station.plantProfileIds } }).select('name').sort({ name: 1 }).lean()
      : [];
    setMonitoringStation(station, profiles);
    res.json({ ...station.toJSON(), monitoredPlants: profiles });
  } catch (error) {
    res.status(400).json({ message: 'We could not save this setup check.' });
  }
});

router.get('/live-summary', (req, res) => res.json(getMonitoringStation()));

module.exports = router;
