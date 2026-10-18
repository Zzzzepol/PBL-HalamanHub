const { shopConnection } = require('../config/connections');
const IrrigationSettings = require('./IrrigationSettings');

// The cloud keeps a mirror in the original collection, so existing settings
// can be imported once and online tools can still read the latest values.
module.exports = shopConnection === IrrigationSettings.db
  ? IrrigationSettings
  : shopConnection.model('IrrigationSettings', IrrigationSettings.schema);
