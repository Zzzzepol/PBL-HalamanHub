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

    // Ultrasonic tank sensor calibration — distance (cm) from the mounted
    // sensor down to the water surface. Admin-adjustable so recalibrating
    // after remounting the sensor never requires reflashing the ESP32.
    tankEmptyDistanceCm:    { type: Number, default: 100 }, // reading when tank is empty (max distance)
    tankFullDistanceCm:     { type: Number, default: 10 },  // reading when tank is full (min distance)
    tankLowThresholdPercent:{ type: Number, default: 20, min: 0, max: 100 }, // below this % counts as "LOW" for the safety switch

    // Pulse irrigation ("cycle-and-soak") timing — how long the pump/solenoid
    // stays open per pulse, and how long it waits before checking again.
    // In seconds (friendlier for a slider UI); the ESP32 converts to ms.
    pumpOnTimeSec: { type: Number, default: 60, min: 5, max: 600 },     // 5s–10min per pulse
    soakTimeSec:   { type: Number, default: 300, min: 30, max: 3600 }, // 30s–1hr wait

    updatedBy: { type: String, default: '' }, // admin name, for the activity log
  },
  { timestamps: true }
);

irrigationSettingsSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('IrrigationSettings', irrigationSettingsSchema);