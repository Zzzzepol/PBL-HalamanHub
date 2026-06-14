// ============================================================
// HalamanHub Server — Irrigation Schedule model
// ============================================================
const mongoose = require('mongoose');

const irrigationScheduleSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // e.g. "07:00 AM"
    zone: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true }, // e.g. "Daily", "Mon / Wed / Fri"
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
    duration: { type: Number, required: true, min: 1 }, // minutes
  },
  { timestamps: true }
);

irrigationScheduleSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('IrrigationSchedule', irrigationScheduleSchema);
