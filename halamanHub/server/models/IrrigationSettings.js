// HalamanHub Server — Irrigation Settings model
// Singleton document: there is only ever one of these.
// Holds the thresholds and manual-override state the ESP32 polls
// on every cycle to decide how to run the pump/solenoid.

const mongoose = require('mongoose');

const irrigationSettingsSchema = new mongoose.Schema(
  {
    // Below this moisture %, soil is considered dry (trigger watering)
    moistureDryThreshold: { type: Number, default: 30, min: 0, max: 100 },
    // Above this moisture %, soil is considered wet enough (stop watering)
    moistureWetThreshold: { type: Number, default: 60, min: 0, max: 100 },

    // 'auto'   → ESP32 decides pump/solenoid based on the thresholds above
    // 'manual' → ESP32 just obeys manualPump / manualSolenoid directly
    mode: { type: String, enum: ['auto', 'manual'], default: 'auto' },

    manualPump:     { type: Boolean, default: false },
    manualSolenoid: { type: Boolean, default: false },

    updatedBy: { type: String, default: '' }, // admin name, for the activity log
  },
  { timestamps: true }
);

irrigationSettingsSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('IrrigationSettings', irrigationSettingsSchema);