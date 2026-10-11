const mongoose = require('mongoose');
const { shopConnection } = require('../config/connections');

const soilTargetsSchema = new mongoose.Schema({
  useDefault: { type: Boolean, default: true },
  npk: {
    nitrogen: { type: Number, default: null },
    phosphorus: { type: Number, default: null },
    potassium: { type: Number, default: null },
  },
  ec: { type: Number, default: null },
  ph: { type: Number, default: null },
}, { _id: false });

// Monitoring profiles live in their own collection, separate from shop
// Products, so syncing one never creates a customer-facing listing.
const cloudPlantProfileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  plantKey: { type: String, required: true, unique: true },
  imageUrl: { type: String, default: '' },
  soilTargets: { type: soilTargetsSchema, default: () => ({}) },
}, { timestamps: true, collection: 'cloudplantprofiles' });

cloudPlantProfileSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = shopConnection.model('CloudPlantProfile', cloudPlantProfileSchema);
