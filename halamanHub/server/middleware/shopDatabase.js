const { isShopConfigured, isShopConnected } = require('../config/connections');

function requireShopDatabase(req, res, next) {
  if (isShopConnected()) return next();

  const message = isShopConfigured()
    ? 'The cloud application database is unavailable. ESP32 readings and local plant profiles continue on the laptop.'
    : 'The cloud application database is not configured. ESP32 readings and local plant profiles remain available on the laptop.';

  return res.status(503).json({ message, code: 'CLOUD_DATABASE_UNAVAILABLE' });
}

module.exports = { requireShopDatabase };
