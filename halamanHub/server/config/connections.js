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

// Keep accounts, shop data, general settings, and alerts in the cloud.
// The laptop owns ESP32 readings, plant profiles, and watering controls/history.
const adminConnection = shopConnection;

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
