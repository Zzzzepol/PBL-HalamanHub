const mongoose = require('mongoose');
const { localConnection } = require('../config/connections');

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

const plantProfileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, default: 'Plant', trim: true, maxlength: 80 },
  plantKey: { type: String, trim: true },
  imageUrl: { type: String, default: '' },
  soilTargets: { type: soilTargetsSchema, default: () => ({}) },
  // Present only when the profile was copied from a shop product. The shop
  // catalog remains separate; only plant identity and its photo sync.
  sourceProductId: { type: String, unique: true, sparse: true },
  shopSyncEnabled: { type: Boolean, default: false },
  lastShopSyncAt: { type: Date, default: null },
}, { timestamps: true });

plantProfileSchema.index({ plantKey: 1 }, {
  unique: true,
  partialFilterExpression: { plantKey: { $type: 'string' } },
});
plantProfileSchema.index({ name: 1 });

plantProfileSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = localConnection.model('PlantProfile', plantProfileSchema);
