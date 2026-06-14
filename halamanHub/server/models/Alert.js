// HalamanHub Server — Alert / Notification model

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['ok', 'warning', 'error'], default: 'ok' },
    icon: { type: String, default: 'ti-info-circle' }, // Tabler icon class
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

alertSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('Alert', alertSchema);
