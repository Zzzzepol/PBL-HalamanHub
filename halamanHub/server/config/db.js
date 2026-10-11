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

function logConnectionEvents(connection, label) {
  connection.on('connected', () => console.log(`[MongoDB] ${label} connected.`));
  connection.on('error', (err) => console.error(`[MongoDB] ${label} error:`, err.message));
  connection.on('disconnected', () => console.warn(`[MongoDB] ${label} disconnected.`));
}

logConnectionEvents(connections.localConnection, 'Local plant database');
if (connections.shopConnection !== connections.localConnection) {
  logConnectionEvents(connections.shopConnection, 'Cloud shop database');
}

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
  await connection.openUri(uri, connectionOptions);
  return connection;
}

async function connectShopDatabase() {
  if (!connections.shopUri || connections.shopConnection === connections.localConnection) return;
  try {
    await openConnection(connections.shopConnection, connections.shopUri);
    shopRetryDelayMs = 5000;
  } catch (err) {
    console.warn(`[MongoDB] Cloud shop database is unavailable; local monitoring remains available. ${err.message}`);
    if (!shopRetryTimer) {
      shopRetryTimer = setTimeout(() => {
        shopRetryTimer = null;
        connectShopDatabase();
      }, shopRetryDelayMs);
      shopRetryTimer.unref?.();
      shopRetryDelayMs = Math.min(shopRetryDelayMs * 2, 60000);
    }
  }
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
  if (shopRetryTimer) clearTimeout(shopRetryTimer);
  const uniqueConnections = new Set([connections.localConnection, connections.shopConnection]);
  await Promise.all([...uniqueConnections].map((connection) => connection.close()));
}

module.exports = connectDB;
module.exports.closeDBs = closeDBs;
