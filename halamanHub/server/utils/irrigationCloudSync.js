const IrrigationSettings = require('../models/IrrigationSettings');
const CloudIrrigationSettings = require('../models/CloudIrrigationSettings');
const IrrigationLog = require('../models/IrrigationLog');
const CloudIrrigationLog = require('../models/CloudIrrigationLog');
const { shopConnection, isShopConfigured, isShopConnected } = require('../config/connections');

const SYNC_INTERVAL_MS = 15 * 1000;
const BATCH_SIZE = 250;
const SETTINGS_FIELDS = [
  'moistureDryThreshold', 'moistureWetThreshold', 'mode', 'wateringEnabled',
  'manualPump', 'manualSolenoid', 'manualControlExpiresAt', 'settingsVersion',
  'lockoutResetVersion', 'deviceBootId', 'deviceLastSeenAt',
  'tankEmptyDistanceCm', 'tankFullDistanceCm', 'tankLowThresholdPercent',
  'pumpOnTimeSec', 'soakTimeSec', 'updatedBy',
];

let initialization = null;
let timer = null;
let syncInProgress = false;
let lastImportedCloudLogId = null;
let lastExportedLogUpdatedAt = null;
let lastExportedLogId = null;

function controlFields(document) {
  return Object.fromEntries(SETTINGS_FIELDS
    .filter((field) => document[field] !== undefined)
    .map((field) => [field, document[field]]));
}

async function getLocalIrrigationSettings() {
  const existing = await IrrigationSettings.findOne();
  if (existing) return existing;
  if (initialization) return initialization;

  initialization = (async () => {
    const again = await IrrigationSettings.findOne();
    if (again) return again;

    let cloudLookupFailed = false;
    if (isShopConnected() && shopConnection !== IrrigationSettings.db) {
      try {
        const cloud = await CloudIrrigationSettings.findOne().lean();
        if (cloud) {
          const fields = controlFields(cloud);
          // A saved manual-on command must never be replayed on a new laptop.
          return IrrigationSettings.create({
            _id: cloud._id,
            ...fields,
            manualPump: false,
            manualSolenoid: false,
            manualControlExpiresAt: null,
            deviceBootId: '',
            deviceLastSeenAt: null,
            settingsVersion: Math.max(1, Number(cloud.settingsVersion) || 1) + 1,
          });
        }
      } catch (error) {
        cloudLookupFailed = true;
        console.warn(`[Watering sync] Cloud import will retry. ${error.message}`);
      }
    }

    // Keep this provisional record off the control wire until staff save
    // local settings or the old cloud settings can be imported. This avoids
    // silently replacing thresholds already saved on the ESP32.
    return IrrigationSettings.create({
      bootstrapFromCloudPending: isShopConfigured()
        && shopConnection !== IrrigationSettings.db
        && (!isShopConnected() || cloudLookupFailed),
    });
  })().catch(async (error) => {
    // Another request may have initialized the singleton while this one waited.
    if (error.code === 11000) {
      const created = await IrrigationSettings.findOne();
      if (created) return created;
    }
    throw error;
  }).finally(() => { initialization = null; });

  return initialization;
}

async function syncSettings() {
  let local = await getLocalIrrigationSettings();
  let cloud = await CloudIrrigationSettings.findOne().lean();

  if (local.bootstrapFromCloudPending) {
    if (cloud) {
      const fields = controlFields(cloud);
      // Import only before a staff edit. Keep the live USB boot session and
      // clear any old manual command from the cloud copy.
      const imported = await IrrigationSettings.findOneAndUpdate(
        { _id: local._id, bootstrapFromCloudPending: true },
        { $set: {
          ...fields,
          manualPump: false,
          manualSolenoid: false,
          manualControlExpiresAt: null,
          deviceBootId: local.deviceBootId,
          deviceLastSeenAt: local.deviceLastSeenAt,
          settingsVersion: Math.max(Number(local.settingsVersion) || 1, Number(cloud.settingsVersion) || 1) + 1,
          bootstrapFromCloudPending: false,
        } },
        { new: true, runValidators: true }
      );
      if (imported) console.log('[Watering sync] Imported existing cloud settings to the laptop.');
      local = imported || await IrrigationSettings.findById(local._id);
    } else {
      const ready = await IrrigationSettings.findOneAndUpdate(
        { _id: local._id, bootstrapFromCloudPending: true },
        { $set: { bootstrapFromCloudPending: false } },
        { new: true }
      );
      local = ready || await IrrigationSettings.findById(local._id);
    }
  }

  const fields = controlFields(local);
  if (cloud && JSON.stringify(controlFields(cloud)) === JSON.stringify(fields)) return;

  // Local settings are authoritative once initialized. A change made while
  // offline is mirrored on the next successful cloud connection.
  if (cloud) {
    await CloudIrrigationSettings.updateOne({ _id: cloud._id }, { $set: fields });
  } else {
    await CloudIrrigationSettings.create({ _id: local._id, ...fields });
  }
}

async function importCloudLogs() {
  while (isShopConnected()) {
    const query = lastImportedCloudLogId ? { _id: { $gt: lastImportedCloudLogId } } : {};
    const logs = await CloudIrrigationLog.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).lean();
    if (!logs.length) return;
    await IrrigationLog.bulkWrite(logs.map(({ __v, ...record }) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $setOnInsert: record },
        upsert: true,
      },
    })), { ordered: false, timestamps: false });
    lastImportedCloudLogId = logs[logs.length - 1]._id;
  }
}

async function exportLocalLogs() {
  while (isShopConnected()) {
    const query = lastExportedLogUpdatedAt
      ? { $or: [
          { updatedAt: { $gt: lastExportedLogUpdatedAt } },
          { updatedAt: lastExportedLogUpdatedAt, _id: { $gt: lastExportedLogId } },
        ] }
      : {};
    const logs = await IrrigationLog.find(query).sort({ updatedAt: 1, _id: 1 }).limit(BATCH_SIZE).lean();
    if (!logs.length) return;
    await CloudIrrigationLog.bulkWrite(logs.map(({ __v, _id, ...record }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: record },
        upsert: true,
      },
    })), { ordered: false, timestamps: false });
    lastExportedLogUpdatedAt = logs[logs.length - 1].updatedAt;
    lastExportedLogId = logs[logs.length - 1]._id;
  }
}

async function syncIrrigationData() {
  if (syncInProgress || !isShopConnected() || shopConnection === IrrigationSettings.db) return;
  syncInProgress = true;
  try {
    await syncSettings();
    await importCloudLogs();
    await exportLocalLogs();
  } catch (error) {
    console.warn(`[Watering sync] Local changes will retry when the cloud is available. ${error.message}`);
  } finally {
    syncInProgress = false;
  }
}

function startIrrigationCloudSync() {
  if (timer || shopConnection === IrrigationSettings.db) return;
  shopConnection.on('connected', syncIrrigationData);
  syncIrrigationData();
  timer = setInterval(syncIrrigationData, SYNC_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { getLocalIrrigationSettings, syncIrrigationData, startIrrigationCloudSync };
