const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const CloudSensor = require('../models/CloudSensor');
const CloudSensorReading = require('../models/CloudSensorReading');
const { shopConnection, isShopConnected } = require('../config/connections');

const BATCH_SIZE = 500;
const SYNC_INTERVAL_MS = 15 * 1000;
let timer = null;
let syncInProgress = false;
let lastSyncedReadingId = null;

async function syncSensorSnapshots() {
  const sensors = await Sensor.find().lean();

  for (const sensor of sensors) {
    const current = await CloudSensor.findOne({ sensorId: sensor.sensorId }).select('lastReadingAt').lean();
    if (current?.lastReadingAt && new Date(current.lastReadingAt) > new Date(sensor.lastReadingAt)) continue;

    const { __v, _id, ...snapshot } = sensor;
    await CloudSensor.updateOne(
      { sensorId: sensor.sensorId },
      { $set: snapshot },
      { upsert: true }
    );
  }
}

async function syncReadingHistory() {
  while (isShopConnected()) {
    const query = lastSyncedReadingId ? { _id: { $gt: lastSyncedReadingId } } : {};
    const readings = await SensorReading.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).lean();
    if (!readings.length) return;

    const operations = readings.map((reading) => {
      const { __v, ...record } = reading;
      const identity = record.deviceSequence == null
        ? { _id: record._id }
        : {
            device: record.device,
            deviceBootId: record.deviceBootId || '',
            deviceSequence: record.deviceSequence,
          };

      return {
        updateOne: {
          filter: identity,
          update: { $setOnInsert: record },
          upsert: true,
        },
      };
    });

    await CloudSensorReading.bulkWrite(operations, { ordered: false });
    lastSyncedReadingId = readings[readings.length - 1]._id;
  }
}

async function syncSensorData() {
  if (syncInProgress || !isShopConnected() || shopConnection.readyState !== 1) return;
  syncInProgress = true;

  try {
    await syncSensorSnapshots();
    await syncReadingHistory();
  } catch (error) {
    console.warn(`[Sensor sync] Local sensor data is queued for the next cloud connection. ${error.message}`);
  } finally {
    syncInProgress = false;
  }
}

function startSensorCloudSync() {
  if (timer || shopConnection === Sensor.db) return;

  // Polling catches both a cloud connection restored after an outage and new
  // local readings. Orders and other application collections are never copied.
  syncSensorData();
  timer = setInterval(syncSensorData, SYNC_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { startSensorCloudSync, syncSensorData };
