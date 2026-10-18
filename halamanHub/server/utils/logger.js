const ActivityLog = require('../models/ActivityLog');
const { isShopConnected } = require('../config/connections');

async function log({ user, userId, action, category, details, status }) {
  if (!isShopConnected()) return;
  try {
    await ActivityLog.create({ user, userId, action, category, details, status });
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

module.exports = log;
