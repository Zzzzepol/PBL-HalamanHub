const { isShopConfigured, isShopConnected } = require('../config/connections');

function requireShopDatabase(req, res, next) {
  if (isShopConnected()) return next();

  const message = isShopConfigured()
    ? 'The online shop database is unavailable. Plant monitoring and watering continue locally.'
    : 'The online shop database is not configured. Plant monitoring and watering continue locally.';

  return res.status(503).json({ message, code: 'SHOP_DATABASE_UNAVAILABLE' });
}

module.exports = { requireShopDatabase };
