// ============================================================
// HalamanHub Server — Sensor model
// Represents a single ESP32-connected sensor reading
// ============================================================
const mongoose = require('mongoose');

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

sensorSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('Sensor', sensorSchema);
