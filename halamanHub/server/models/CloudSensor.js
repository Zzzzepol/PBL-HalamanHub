const { shopConnection } = require('../config/connections');
const Sensor = require('./Sensor');

// Reuse the sensor schema and collection name on the cloud connection.
module.exports = shopConnection === Sensor.db
  ? Sensor
  : shopConnection.model('Sensor', Sensor.schema);
