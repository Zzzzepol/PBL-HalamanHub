const { shopConnection } = require('../config/connections');
const IrrigationLog = require('./IrrigationLog');

module.exports = shopConnection === IrrigationLog.db
  ? IrrigationLog
  : shopConnection.model('IrrigationLog', IrrigationLog.schema);
