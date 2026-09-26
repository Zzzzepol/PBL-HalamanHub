// HalamanHub Server — Sensor Reading model
// Stores a history of every telemetry payload sent by the ESP32,
// used to power Analytics charts (trends over time).

const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema(
  {
    device: { type: String, required: true, trim: true }, // ESP32 device ID

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

    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Speeds up "give me the last 24h of readings" queries for Analytics
sensorReadingSchema.index({ recordedAt: -1 });

sensorReadingSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);