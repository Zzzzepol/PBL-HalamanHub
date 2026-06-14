const ActivityLog = require('../models/ActivityLog');

async function log({ user, userId, action, category, details, status }) {
  try {
    await ActivityLog.create({ user, userId, action, category, details, status });
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

module.exports = log;