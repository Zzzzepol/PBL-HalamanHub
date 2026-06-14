// ============================================================
// HalamanHub Server — Order model
// Status flow: pending → confirmed → processing → ready → completed
//              pending → cancelled

const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  note:      { type: String, default: '' },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: String, default: 'admin' },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    orderNumber:  { type: String, required: true, unique: true },
    customer:     { type: String, required: true, trim: true },
    customerEmail:{ type: String, trim: true, default: '' },
    customerPhone:{ type: String, trim: true, default: '' },
    product:      { type: String, required: true, trim: true },
    quantity:     { type: Number, default: 1, min: 1 },
    amount:       { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'],
      default: 'pending',
    },
    payment: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    note:         { type: String, default: '' },
    statusHistory:{ type: [statusHistorySchema], default: [] },
    orderDate:    { type: Date, default: Date.now },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('Order', orderSchema);
