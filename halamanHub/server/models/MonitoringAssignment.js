const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

// Each assignment starts a new time interval. The next row ends the previous
// interval, so delayed ESP32 samples retain the plot active when sampled.
const schema = new mongoose.Schema({
  plotId: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringPlot', required: true },
  plotName: { type: String, required: true },
  monitoredPlantNames: { type: [String], default: [] },
  startedAt: { type: Date, required: true, index: true },
}, { timestamps: true });

module.exports = localConnection.model('MonitoringAssignment', schema);
