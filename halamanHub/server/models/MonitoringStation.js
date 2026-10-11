const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

const checkSchema = new mongoose.Schema({
  checkedAt: { type: Date, default: null },
  checkedBy: { type: String, default: '' },
  notes: { type: String, default: '', maxlength: 500 },
}, { _id: false });

const monitoringStationSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  name: { type: String, default: 'Main System', trim: true, maxlength: 80 },
  location: { type: String, default: '', trim: true, maxlength: 120 },
  plantProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlantProfile' }],
  checks: {
    probePlacement: { type: checkSchema, default: () => ({}) },
    readingsVerified: { type: checkSchema, default: () => ({}) },
    waterOutputsTested: { type: checkSchema, default: () => ({}) },
    autoCycleTested: { type: checkSchema, default: () => ({}) },
  },
}, { timestamps: true });

monitoringStationSchema.statics.getSingleton = async function () {
  let station = await this.findOne({ key: 'main' });
  if (!station) station = await this.create({ key: 'main' });
  return station;
};

monitoringStationSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = localConnection.model('MonitoringStation', monitoringStationSchema);
