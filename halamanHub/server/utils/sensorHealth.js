// Runs periodically (see index.js) since sensor "offline" is a
// silence, not an event — nothing pushes it to us, so we have to
// go looking for it ourselves.
const Sensor = require('../models/Sensor');
const { createAlertIfEnabled } = require('./alerts');
const { getIO } = require('../socket');

const OFFLINE_AFTER_MS = 5 * 60 * 1000; // no reading in 5 minutes = offline

async function checkSensorHealth() {
  try {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);
    const stale = await Sensor.find({ lastReadingAt: { $lt: cutoff }, status: { $ne: 'offline' } });

    for (const sensor of stale) {
      sensor.status = 'offline';
      await sensor.save();

      await createAlertIfEnabled('sensorFailure', {
        type: 'error',
        icon: 'ti-plug-connected-x',
        message: `${sensor.type} sensor (${sensor.zone}) stopped reporting and is now offline.`,
      });
    }

    // A timeout is not a sensor event, so explicitly tell connected pages to
    // refresh their snapshots when a sensor becomes inactive.
    if (stale.length > 0) {
      try {
        getIO().emit('sensor:status', {
          sensorIds: stale.map(sensor => sensor.sensorId),
          status: 'offline',
          changedAt: new Date().toISOString(),
        });
      } catch (socketErr) {
        console.warn('[Socket.io] Sensor status broadcast skipped:', socketErr.message);
      }
    }
  } catch (err) {
    console.error('Sensor health check failed:', err.message);
  }
}

module.exports = { checkSensorHealth };
