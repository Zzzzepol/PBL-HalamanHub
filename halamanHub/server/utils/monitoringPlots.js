const MonitoringStation = require('../models/MonitoringStation');
const MonitoringPlot = require('../models/MonitoringPlot');
const MonitoringAssignment = require('../models/MonitoringAssignment');
const PlantProfile = require('../models/PlantProfile');
const { setMonitoringStation } = require('./monitoringStationState');

const nameKey = (name) => String(name || '').trim().toLocaleLowerCase('en');

async function profileNames(ids) {
  if (!ids?.length) return [];
  const profiles = await PlantProfile.find({ _id: { $in: ids } }).select('name').lean();
  return profiles.map((item) => item.name);
}

async function addAssignment(plot, at = new Date()) {
  return MonitoringAssignment.create({
    plotId: plot._id,
    plotName: plot.name,
    monitoredPlantNames: await profileNames(plot.plantProfileIds),
    startedAt: at,
  });
}

async function ensureMonitoringPlots() {
  const station = await MonitoringStation.getSingleton();
  let plots = await MonitoringPlot.find().sort({ createdAt: 1 });
  if (!plots.length) {
    const initialName = station.location?.trim() || 'Main growing area';
    const initial = await MonitoringPlot.findOneAndUpdate(
      { legacyKey: 'main' },
      { $setOnInsert: {
        name: initialName, nameKey: nameKey(initialName), legacyKey: 'main',
        legacyLocation: station.location || '', plantProfileIds: station.plantProfileIds || [],
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    plots = [initial];
  }
  let active = plots.find((plot) => String(plot._id) === String(station.activePlotId));
  if (!active) active = plots[0];
  const latestAssignment = await MonitoringAssignment.findOne().sort({ startedAt: -1, _id: -1 }).lean();
  const assignedPlot = latestAssignment
    ? plots.find((plot) => String(plot._id) === String(latestAssignment.plotId)) : null;
  if (assignedPlot) active = assignedPlot;
  let changed = false;
  if (!station.activePlotId || String(station.activePlotId) !== String(active._id)) {
    station.activePlotId = active._id;
    station.activeSince = latestAssignment?.startedAt || new Date();
    changed = true;
  }
  if (!station.wateredPlotId) { station.wateredPlotId = active._id; changed = true; }
  if (station.location !== active.name) { station.location = active.name; changed = true; }
  if ((station.plantProfileIds || []).map(String).join('|') !== active.plantProfileIds.map(String).join('|')) {
    station.plantProfileIds = active.plantProfileIds;
    changed = true;
  }
  if (changed) await station.save();
  if (!latestAssignment) await addAssignment(active, station.activeSince || new Date());
  const profiles = active.plantProfileIds.length
    ? await PlantProfile.find({ _id: { $in: active.plantProfileIds } }).select('name').lean() : [];
  setMonitoringStation(station, profiles);
  return { station, plots, active };
}

async function assignmentForSample(sampledAt, trustedTime) {
  if (!trustedTime) return null;
  return MonitoringAssignment.findOne({ startedAt: { $lte: sampledAt } }).sort({ startedAt: -1, _id: -1 }).lean();
}

module.exports = { nameKey, ensureMonitoringPlots, addAssignment, assignmentForSample };
