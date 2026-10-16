const { shopConnection } = require('../config/connections');
const SensorReading = require('./SensorReading');

// Reuse the sensor history schema and collection name on the cloud connection.
module.exports = shopConnection === SensorReading.db
  ? SensorReading
  : shopConnection.model('SensorReading', SensorReading.schema);
