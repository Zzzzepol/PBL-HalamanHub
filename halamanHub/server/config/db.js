const mongoose = require('mongoose');
const connections = require('./connections');

mongoose.set('strictQuery', true);

const connectionOptions = {
  serverSelectionTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000,
  connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000,
};

let localConnectPromise = null;
let shopRetryTimer = null;
let shopRetryDelayMs = 5000;
let shopConnectPromise = null;
let shuttingDown = false;

function clearShopRetry() {
  if (shopRetryTimer) clearTimeout(shopRetryTimer);
  shopRetryTimer = null;
}

function scheduleShopRetry() {
  if (shuttingDown || !connections.shopUri || connections.shopConnection === connections.localConnection || shopRetryTimer) return;

  const delayMs = shopRetryDelayMs;
  shopRetryTimer = setTimeout(() => {
    shopRetryTimer = null;
    connectShopDatabase();
  }, delayMs);
  shopRetryTimer.unref?.();
  shopRetryDelayMs = Math.min(shopRetryDelayMs * 2, 60000);
  console.warn(`[MongoDB] Cloud reconnect scheduled in ${Math.ceil(delayMs / 1000)} seconds.`);
}

function logConnectionEvents(connection, label) {
  connection.on('connected', () => {
    if (connection === connections.shopConnection) {
      clearShopRetry();
      shopRetryDelayMs = 5000;
    }
    console.log(`[MongoDB] ${label} connected.`);
  });
  connection.on('error', (err) => {
    console.error(`[MongoDB] ${label} error:`, err.message);
    if (connection === connections.shopConnection && connection.readyState !== 1) scheduleShopRetry();
  });
  connection.on('disconnected', () => {
    console.warn(`[MongoDB] ${label} disconnected.`);
    if (connection === connections.shopConnection) scheduleShopRetry();
  });
}

logConnectionEvents(connections.localConnection, 'Local ESP32 plant database');
if (connections.shopConnection !== connections.localConnection) {
  logConnectionEvents(connections.shopConnection, 'Cloud application database');
}

// Online (Atlas) only: force the database name like the old
// mongoose.connect(MONGODB_URI, { dbName: 'halamanhub' }).
const ONLINE_DB_NAME = process.env.SHOP_DB_NAME || 'halamanhub';

async function openConnection(connection, uri) {
  if (!uri) throw new Error('No MongoDB URI is configured for this database.');
  if (connection.readyState === 1) return connection;
  if (connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      connection.once('connected', resolve);
      connection.once('error', reject);
    });
    return connection;
  }
  const options = connection === connections.shopConnection
    ? { ...connectionOptions, dbName: ONLINE_DB_NAME }
    : connectionOptions;
  await connection.openUri(uri, options);
  return connection;
}

async function connectShopDatabase() {
  if (!connections.shopUri || connections.shopConnection === connections.localConnection) return;
  if (connections.shopConnection.readyState === 1) return true;
  if (shopConnectPromise) return shopConnectPromise;

  shopConnectPromise = openConnection(connections.shopConnection, connections.shopUri)
    .then(() => {
      shopRetryDelayMs = 5000;
      return true;
    })
    .catch((err) => {
      console.warn(`[MongoDB] Cloud application database is unavailable; local ESP32 telemetry remains available. ${err.message}`);
      scheduleShopRetry();
      return false;
    })
    .finally(() => {
      shopConnectPromise = null;
    });

  return shopConnectPromise;
}

async function connectDB() {
  if (!connections.localUri) {
    throw new Error('Set IOT_MONGODB_URI to the laptop MongoDB address in server/.env.');
  }

  if (!localConnectPromise) {
    localConnectPromise = openConnection(connections.localConnection, connections.localUri)
      .catch((err) => {
        localConnectPromise = null;
        throw new Error(`Could not connect to the local plant database: ${err.message}`);
      });
  }

  await localConnectPromise;
  // The shop database is optional for local plant monitoring and watering.
  // Start its connection without holding up the local server startup.
  connectShopDatabase();
  return connections.localConnection;
}

async function closeDBs() {
  shuttingDown = true;
  clearShopRetry();
  const uniqueConnections = new Set([connections.localConnection, connections.shopConnection]);
  await Promise.all([...uniqueConnections].map((connection) => connection.close()));
}

module.exports = connectDB;
module.exports.closeDBs = closeDBs;
module.exports.connectShopDatabase = connectShopDatabase;
