const mongoose = require('mongoose');

const localUri = process.env.IOT_MONGODB_URI
  || process.env.MONGODB_URI
  || process.env.SHOP_MONGODB_URI
  || '';
const shopUri = process.env.SHOP_MONGODB_URI
  || process.env.MONGODB_URI
  || (!process.env.IOT_MONGODB_URI ? localUri : '');

const localConnection = mongoose.createConnection();
const shopConnection = shopUri && shopUri === localUri
  ? localConnection
  : mongoose.createConnection();

// Admin accounts, alerts, and settings stay on the laptop when an explicit
// local IoT database is configured. Legacy single-database installs continue
// to use that same database for both groups.
const adminConnection = process.env.IOT_MONGODB_URI ? localConnection : shopConnection;

function isLocalConnected() {
  return localConnection.readyState === 1;
}

function isShopConfigured() {
  return Boolean(shopUri);
}

function isShopConnected() {
  return Boolean(shopUri) && shopConnection.readyState === 1;
}

module.exports = {
  localConnection,
  shopConnection,
  adminConnection,
  localUri,
  shopUri,
  isLocalConnected,
  isShopConfigured,
  isShopConnected,
};
