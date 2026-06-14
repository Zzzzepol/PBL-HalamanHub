// ============================================================
// HalamanHub Server — Settings model (singleton document)
// Stores farm configuration, thresholds, and notification prefs.
// ============================================================
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Singleton key — always 'default'
    key: { type: String, default: 'default', unique: true },

    farmName: { type: String, default: 'HalamanHub Farm - Sta. Rosa' },
    location: { type: String, default: 'Barangay Sta. Rosa, Laguna, PH' },
    timezone: { type: String, default: 'Asia/Manila' },

    thresholds: {
      minSoilMoisture: { type: Number, default: 30 },
      phRange: { type: String, default: '6.0 – 7.0' },
      maxEC: { type: Number, default: 2.5 },
      irrigationStart: { type: Number, default: 40 }, // % moisture to start irrigation
      irrigationStop: { type: Number, default: 80 },  // % moisture to stop irrigation
      maxIrrigationDuration: { type: Number, default: 30 }, // minutes
    },

    notifications: {
      lowMoisture: { type: Boolean, default: true },
      waterTank: { type: Boolean, default: true },
      sensorFailure: { type: Boolean, default: true },
      irrigation: { type: Boolean, default: true },
      orders: { type: Boolean, default: false },
    },

    autoIrrigationEnabled: { type: Boolean, default: true },
    autoSwitchToMunicipal: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingsSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

// Helper: fetch (or create) the single settings document
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ key: 'default' });
  if (!settings) {
    settings = await this.create({ key: 'default' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
