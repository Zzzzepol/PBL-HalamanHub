
const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

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

module.exports = localConnection.model('IrrigationSchedule', irrigationScheduleSchema);
