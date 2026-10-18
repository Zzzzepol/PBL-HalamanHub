const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  nameKey: { type: String, required: true, unique: true },
  plantProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlantProfile' }],
  legacyKey: { type: String, unique: true, sparse: true },
  legacyLocation: { type: String, default: '' },
}, { timestamps: true });

module.exports = localConnection.model('MonitoringPlot', schema);
