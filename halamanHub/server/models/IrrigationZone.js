// HalamanHub Server — Irrigation Zone model

const mongoose = require('mongoose');

const irrigationZoneSchema = new mongoose.Schema(
  {
    zoneId: { type: String, required: true, unique: true }, // e.g. zone-a
    name: { type: String, required: true, trim: true },     // e.g. Zone A
    status: { type: String, enum: ['active', 'idle'], default: 'idle' },
    lastRunSummary: { type: String, default: '' }, // human-readable summary, e.g. "Yesterday at 7:00 AM · 25 min"
    lastRunAt: { type: Date },
    lastRunDurationMin: { type: Number },
    nextRunSummary: { type: String, default: '' }, // e.g. "Tomorrow 7:30 AM"
  },
  { timestamps: true }
);

irrigationZoneSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('IrrigationZone', irrigationZoneSchema);
