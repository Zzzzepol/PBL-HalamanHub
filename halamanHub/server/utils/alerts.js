
const Alert = require('../models/Alert');
const Settings = require('../models/Settings');

/**
 * Creates a new Alert — but only if the admin has this notification
 * category turned on in Settings.
 * @param {'lowMoisture'|'waterTank'|'sensorFailure'|'irrigation'|'orders'} category
 * @param {{ type: 'ok'|'warning'|'error', icon: string, message: string }} alert
 */
async function createAlertIfEnabled(category, alert) {
  try {
    const settings = await Settings.getSingleton();
    if (settings.notifications && settings.notifications[category] === false) {
      return null; // admin turned this category off
    }
    return await Alert.create(alert);
  } catch (err) {
    console.error('Failed to create alert:', err.message);
    return null;
  }
}

module.exports = { createAlertIfEnabled };