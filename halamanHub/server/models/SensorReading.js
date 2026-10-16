// HalamanHub Server — Sensor Reading model
// Stores a history of every telemetry payload sent by the ESP32,
// used to power Analytics charts (trends over time).

const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

const sensorReadingSchema = new mongoose.Schema(
  {
    device: { type: String, required: true, trim: true }, // ESP32 device ID
    deviceSequence: { type: Number, default: null },
    deviceUptimeMs: { type: Number, default: null },
    bufferDroppedSamples: { type: Number, default: 0 },
    bufferRestartLossCount: { type: Number, default: 0 },
    monitoringStation: { type: String, default: 'Main System' },
    monitoringLocation: { type: String, default: '' },
    monitoredPlantNames: { type: [String], default: [] },

    soilMoisture:   { type: Number },
    soilTemp:       { type: Number },
    ec:             { type: Number },
    ph:             { type: Number },
    nitrogen:       { type: Number },
    phosphorus:     { type: Number },
    potassium:      { type: Number },

    airTemp:        { type: Number },
    airHumidity:    { type: Number },

    distanceCm:     { type: Number }, // raw ultrasonic reading
    levelPercent:   { type: Number }, // calculated fill percentage
    waterAvailable: { type: Boolean },

    // Rainwater Harvesting — TDS/pH/3-state float switches
    tds:         { type: Number },   // water TDS in ppm
    tdsStable:   { type: Boolean, default: true }, // false = ESP32 held last known-good value; this reading is not fresh
    waterPh:     { type: Number },  // water pH (distinct from soil.ph above)
    tankStatus:  { type: String, enum: ['Low', 'Medium', 'Full'] },

    pumpActive:     { type: Boolean, default: false },
    solenoidActive: { type: Boolean, default: false },
    activeSource:   { type: String, enum: ['PUMP', 'SOLENOID', 'NONE'], default: 'NONE' },

    soilReadingValid: { type: Boolean, default: true },
    tankReadingValid: { type: Boolean, default: true },
    airReadingValid: { type: Boolean, default: true },
    irrigationState: { type: String, default: 'UNKNOWN' },
    irrigationCycle: { type: Number, default: 0 },
    timeRemainingSec: { type: Number, default: 0 },
    lockout: { type: Boolean, default: false },
    wateringEnabled: { type: Boolean, default: null },
    deviceBootId: { type: String, default: '' },
    appliedSettingsVersion: { type: Number, default: 0 },
    appliedLockoutResetVersion: { type: Number, default: 0 },

    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Speeds up "give me the last 24h of readings" queries for Analytics
sensorReadingSchema.index({ recordedAt: -1 });
// Speeds up finding the previous reading from one ESP32 during ingestion.
sensorReadingSchema.index({ device: 1, recordedAt: -1 });
sensorReadingSchema.index(
  { device: 1, deviceBootId: 1, deviceSequence: 1 },
  { unique: true, partialFilterExpression: { deviceSequence: { $type: 'number' } } }
);

sensorReadingSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = localConnection.model('SensorReading', sensorReadingSchema);
