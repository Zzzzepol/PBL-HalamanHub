const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

const monitoringStationSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  name: { type: String, default: 'Main System', trim: true, maxlength: 80 },
  location: { type: String, default: '', trim: true, maxlength: 120 },
  plantProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlantProfile' }],
  activePlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringPlot', default: null },
  wateredPlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'MonitoringPlot', default: null },
  activeSince: { type: Date, default: null },
}, { timestamps: true });

monitoringStationSchema.statics.getSingleton = async function () {
  let station = await this.findOne({ key: 'main' });
  if (!station) station = await this.create({ key: 'main' });
  return station;
};

monitoringStationSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = localConnection.model('MonitoringStation', monitoringStationSchema);
