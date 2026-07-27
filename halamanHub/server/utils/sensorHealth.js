// Runs periodically (see index.js) since sensor "offline" is a
// silence, not an event — nothing pushes it to us, so we have to
// go looking for it ourselves.
const Sensor = require('../models/Sensor');
const { createAlertIfEnabled } = require('./alerts');

const OFFLINE_AFTER_MS = 2 * 60 * 1000; // no reading in 2 minutes = offline

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
  } catch (err) {
    console.error('Sensor health check failed:', err.message);
  }
}

module.exports = { checkSensorHealth };