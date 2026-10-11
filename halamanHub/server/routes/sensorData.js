const express = require('express');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const IrrigationLog = require('../models/IrrigationLog');
const IrrigationSettings = require('../models/IrrigationSettings');
const { createAlertIfEnabled } = require('../utils/alerts');
const { getIO } = require('../socket');
const { setLiveReading, getLiveReading } = require('../utils/liveSensorState');
const { getMonitoringStation } = require('../utils/monitoringStationState');
const { requireIotDevice } = require('../middleware/iotDevice');

const router = express.Router();
const DEFAULT_DRY = 30;
const DEFAULT_WET = 60;
const ZONE = 'Main System';
const TANK_ZONE = 'Tank 1';
const MAX_SAMPLE_AGE_MS = 24 * 60 * 60 * 1000;

function sampleDateFromPayload(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || Math.abs(Date.now() - parsed) > MAX_SAMPLE_AGE_MS) return new Date();
  return new Date(parsed);
}

async function upsertSensor(sensorId, type, zone, value, numericValue, device, status, recordedAt) {
  const current = await Sensor.findOne({ sensorId }).select('lastReadingAt').lean();
  if (current?.lastReadingAt && new Date(current.lastReadingAt) > recordedAt) return;
  await Sensor.findOneAndUpdate(
    { sensorId },
    { type, zone, value, numericValue, device, status, lastReadingAt: recordedAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function publishIrrigationLogs(rows) {
  try {
    if (rows.length) getIO().emit('irrigation:log', rows);
  } catch (error) {
    console.warn('[Socket.io] Watering history update skipped:', error.message);
  }
}

async function saveTelemetry(payload, receivedAt) {
  const { soil = {}, air = {}, watering = {}, water = {}, device, deviceBootId } = payload;
  const deviceId = device || 'ESP32-01';
  const bootId = typeof deviceBootId === 'string' ? deviceBootId.slice(0, 80) : '';
  const sequence = Number.isFinite(Number(payload.deviceSequence)) ? Number(payload.deviceSequence) : null;
  const deviceUptimeMs = Number.isFinite(Number(payload.deviceUptimeMs)) ? Number(payload.deviceUptimeMs) : null;
  const sampledAt = sampleDateFromPayload(payload.sampledAtMs);
  const bufferDroppedSamples = Math.max(0, Number(payload.bufferDroppedSamples) || 0);
  const bufferRestartLossCount = Math.max(0, Number(payload.bufferRestartLossCount) || 0);
  const station = getMonitoringStation();
  const soilReadingValid = watering.soilReadingValid !== false;
  const tankReadingValid = watering.tankReadingValid !== false;
  const airReadingValid = air.readingValid !== false;
  const pumpActive = watering.pumpActive === true;
  const solenoidActive = watering.solenoidActive === true;
  const waterAvailable = tankReadingValid && watering.tankWaterLevel === 'OK';
  const levelPercent = watering.levelPercent;
  const distanceCm = watering.distanceCm;

  await IrrigationSettings.updateOne(
    {},
    { $set: { deviceBootId: bootId, deviceLastSeenAt: receivedAt } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  if (sequence !== null && bootId) {
    const duplicate = await SensorReading.findOne({ device: deviceId, deviceBootId: bootId, deviceSequence: sequence }).select('_id').lean();
    if (duplicate) return { duplicate: true, sequence };
  }

  const previous = await SensorReading.findOne({ device: deviceId }).sort({ recordedAt: -1 });

  await Promise.all([
    upsertSensor('LIVE-001', 'Soil moisture', ZONE, `${soil.moisture ?? 0}%`, soil.moisture, deviceId, soilReadingValid ? 'ok' : 'warning', sampledAt),
    upsertSensor('LIVE-002', 'Temperature', ZONE, `${soil.temperature ?? 0}°C`, soil.temperature, deviceId, soilReadingValid ? 'ok' : 'warning', sampledAt),
    upsertSensor('LIVE-003', 'EC', ZONE, `${soil.ec ?? 0} uS/cm`, soil.ec, deviceId, soilReadingValid ? 'ok' : 'warning', sampledAt),
    upsertSensor('LIVE-004', 'pH', ZONE, `${soil.ph ?? 0}`, soil.ph, deviceId, soilReadingValid ? 'ok' : 'warning', sampledAt),
    upsertSensor('LIVE-005', 'NPK', ZONE, `N:${soil.nitrogen ?? 0} P:${soil.phosphorus ?? 0} K:${soil.potassium ?? 0}`, undefined, deviceId, soilReadingValid ? 'ok' : 'warning', sampledAt),
    upsertSensor('LIVE-006', 'Humidity', ZONE, `${air.humidity ?? 0}%`, air.humidity, deviceId, airReadingValid ? 'ok' : 'warning', sampledAt),
    upsertSensor('LIVE-007', 'Water level', TANK_ZONE, `${levelPercent ?? 0}%`, levelPercent, deviceId, !tankReadingValid || !waterAvailable ? 'warning' : 'ok', sampledAt),
  ]);

  const reading = await SensorReading.create({
    device: deviceId,
    deviceSequence: sequence,
    deviceUptimeMs,
    bufferDroppedSamples,
    bufferRestartLossCount,
    monitoringStation: station.name,
    monitoringLocation: station.location,
    monitoredPlantNames: station.monitoredPlantNames,
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
    soilReadingValid,
    tankReadingValid,
    airReadingValid,
    irrigationState: watering.irrigationState || 'UNKNOWN',
    irrigationCycle: watering.cycle ?? 0,
    timeRemainingSec: watering.timeRemainingSec ?? 0,
    lockout: watering.lockout === true,
    deviceBootId: bootId,
    appliedSettingsVersion: watering.appliedSettingsVersion ?? 0,
    appliedLockoutResetVersion: watering.appliedLockoutResetVersion ?? 0,
    tds: water.tds,
    tdsStable: water.tdsStable !== false,
    waterPh: water.ph,
    tankStatus: water.tankStatus,
    recordedAt: sampledAt,
  });

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

  try {
    if ((watering.lockout === true || watering.manualCommandBlocked === true)
        && settings && (settings.manualPump || settings.manualSolenoid)) {
      settings.manualPump = false;
      settings.manualSolenoid = false;
      settings.manualControlExpiresAt = null;
      settings.settingsVersion = (settings.settingsVersion || 0) + 1;
      await settings.save();
    }

    for (const event of events) {
      if (event.source === 'PUMP' && event.action === 'OFF') {
        const lastOn = await IrrigationLog.findOne({ device: deviceId, source: 'PUMP', action: 'ON', durationSec: null, occurredAt: { $lte: sampledAt } }).sort({ occurredAt: -1 });
        if (lastOn) {
          event.durationSec = Math.max(0, Math.round((sampledAt.getTime() - new Date(lastOn.occurredAt).getTime()) / 1000));
          event.moistureBefore = lastOn.moistureAtEvent ?? null;
          lastOn.durationSec = event.durationSec;
          await lastOn.save();
        }
      }
      event.device = deviceId;
      event.moistureAtEvent = moisture;
      event.monitoringLocation = station.location;
      event.occurredAt = sampledAt;
    }

    let savedEvents = [];
    if (events.length) savedEvents = await IrrigationLog.insertMany(events);
    await publishIrrigationLogs(savedEvents.map((event) => event.toJSON()));

    if (['WATERING', 'SOAKING'].includes(previous?.irrigationState) && watering.irrigationState === 'IDLE'
        && soilReadingValid && moisture !== null) {
      const pendingPulse = await IrrigationLog.findOne({ device: deviceId, source: 'PUMP', action: 'OFF', moistureAfterRun: null }).sort({ occurredAt: -1 });
      const maxWaitMs = Math.max(5 * 60 * 1000, (settings?.soakTimeSec || 300) * 1500);
      if (pendingPulse && sampledAt.getTime() - new Date(pendingPulse.occurredAt).getTime() <= maxWaitMs) {
        pendingPulse.moistureAfterRun = moisture;
        pendingPulse.wateringResult = moisture >= wetThreshold
          ? 'target_reached'
          : moisture > (pendingPulse.moistureBefore ?? pendingPulse.moistureAtEvent)
            ? 'improved'
            : 'no_change';
        await pendingPulse.save();
        await publishIrrigationLogs([pendingPulse.toJSON()]);
      }
    }

    for (const event of events) {
      if (event.action !== 'ON') continue;
      createAlertIfEnabled('irrigation', {
        type: 'warning',
        icon: event.source === 'PUMP' ? 'ti-droplet' : 'ti-valve',
        message: `${event.source === 'PUMP' ? 'Pump' : 'Backup water line'} turned ON (${event.reason.replace('_', ' ')}) — soil wetness ${moisture ?? '—'}%.`,
      }).catch((error) => console.warn('[Sensor alerts] Irrigation alert skipped:', error.message));
    }

    const prevMoisture = previous?.soilMoisture;
    if (moisture !== null && moisture < dryThreshold && (prevMoisture == null || prevMoisture >= dryThreshold)) {
      createAlertIfEnabled('lowMoisture', {
        type: 'warning', icon: 'ti-droplet-off',
        message: `Soil wetness dropped to ${moisture}% — below the ${dryThreshold}% start level.`,
      }).catch((error) => console.warn('[Sensor alerts] Soil alert skipped:', error.message));
    }
    const prevWaterAvailable = previous?.waterAvailable;
    if (!waterAvailable && (prevWaterAvailable == null || prevWaterAvailable === true)) {
      createAlertIfEnabled('waterTank', {
        type: 'error', icon: 'ti-alert-triangle',
        message: `Water tank level is low${levelPercent != null ? ` (${levelPercent}%)` : ''} — watering may use the backup line.`,
      }).catch((error) => console.warn('[Sensor alerts] Tank alert skipped:', error.message));
    }
  } catch (error) {
    // The saved reading remains valid even if an optional alert or history
    // event could not be written. Do not ask the ESP32 to resend the sample.
    console.warn('[Sensor events] A watering or alert update was skipped:', error.message);
  }

  return { duplicate: false, sequence, readingId: reading._id };
}

router.get('/live', (req, res) => {
  const reading = getLiveReading();
  if (!reading) return res.status(404).json({ message: 'No live reading received yet.' });
  res.json(reading);
});

router.post('/', requireIotDevice, async (req, res) => {
  const receivedAt = new Date();
  const deviceId = req.body.device || 'ESP32-01';
  const bootId = typeof req.body.deviceBootId === 'string' ? req.body.deviceBootId.slice(0, 80) : '';
  const sequence = Number.isFinite(Number(req.body.deviceSequence)) ? Number(req.body.deviceSequence) : null;
  const sampledAt = sampleDateFromPayload(req.body.sampledAtMs);
  const station = getMonitoringStation();
  const livePayload = {
    device: deviceId,
    soil: req.body.soil || {},
    air: req.body.air || {},
    watering: req.body.watering || {},
    water: req.body.water || {},
    deviceBootId: bootId,
    deviceSequence: sequence,
    bufferDroppedSamples: Math.max(0, Number(req.body.bufferDroppedSamples) || 0),
    bufferRestartLossCount: Math.max(0, Number(req.body.bufferRestartLossCount) || 0),
    monitoringStation: station.name,
    monitoringLocation: station.location,
    monitoredPlantNames: station.monitoredPlantNames,
    sampledAt: sampledAt.toISOString(),
    gatewayReceivedAt: receivedAt.toISOString(),
    recordedAt: sampledAt,
  };

  const latestLive = getLiveReading();
  const latestLiveTime = latestLive ? new Date(latestLive.sampledAt || latestLive.recordedAt).getTime() : 0;
  const sameBoot = latestLive?.deviceBootId === bootId;
  const isNewLiveSample = !latestLive
    || sampledAt.getTime() > latestLiveTime
    || (sameBoot && sequence !== null && latestLive.deviceSequence != null && sequence > latestLive.deviceSequence);
  if (isNewLiveSample) {
    setLiveReading(livePayload);
    try { getIO().emit('sensor:reading', livePayload); }
    catch (error) { console.warn('[Socket.io] Reading broadcast skipped:', error.message); }
  }

  try {
    const result = await saveTelemetry(req.body, receivedAt);
    res.status(202).json({ status: result.duplicate ? 'already-saved' : 'saved', deviceSequence: result.sequence });
  } catch (error) {
    console.error('[Sensor data] Local history save failed; the ESP32 will keep and retry this sample:', error.message);
    res.status(503).json({ message: 'The laptop could not save this reading yet.' });
  }
});

module.exports = router;
