
const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

const sensorSchema = new mongoose.Schema(
  {
    sensorId: { type: String, required: true, unique: true }, // e.g. SNS-001
    type: {
      type: String,
      required: true,
      enum: ['Soil moisture', 'pH', 'EC', 'NPK', 'Temperature', 'Humidity', 'Water level'],
    },
    zone: { type: String, required: true, trim: true }, // e.g. Zone A, Tank 1
    value: { type: String, required: true }, // display value, e.g. "67%", "N:60 P:38 K:67"
    numericValue: { type: Number }, // raw numeric reading, when applicable
    status: { type: String, enum: ['ok', 'warning', 'offline'], default: 'ok' },
    device: { type: String, required: true, trim: true }, // ESP32 device ID
    lastReadingAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sensorSchema.index({ type: 1, zone: 1 });
sensorSchema.index({ status: 1 });

sensorSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = localConnection.model('Sensor', sensorSchema);
