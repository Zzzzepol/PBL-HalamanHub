// HalamanHub Server — Irrigation Log model
// Replaces the old "Irrigation Schedule" concept. Instead of a planned
// schedule, this is a real history of every time the pump or solenoid
// actually turned on/off, and why.

const mongoose = require('mongoose');

const irrigationLogSchema = new mongoose.Schema(
  {
    device: { type: String, required: true, trim: true }, // ESP32 device ID

    source: { type: String, enum: ['PUMP', 'SOLENOID'], required: true },
    action: { type: String, enum: ['ON', 'OFF'], required: true },

    // Why it happened:
    // auto_dry          — auto mode, soil moisture dropped below threshold
    // auto_wet          — auto mode, soil moisture reached the "stop" threshold
    // manual            — admin manually toggled it from the dashboard
    // safety_tank_empty — auto-safety switch: pump turned off / solenoid took
    //                     over because the tank ran dry mid-watering
    reason: {
      type: String,
      enum: ['auto_dry', 'auto_wet', 'manual', 'safety_tank_empty'],
      required: true,
    },

    moistureAtEvent: { type: Number }, // soil moisture % at the time, for context

    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Speeds up "give me the most recent events" queries for the Logs page
irrigationLogSchema.index({ occurredAt: -1 });

irrigationLogSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('IrrigationLog', irrigationLogSchema);