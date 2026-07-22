// ============================================================
// HalamanHub Server — ShopOrder model
// Customer-facing orders with PayMongo payment tracking
// ============================================================
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  name:      { type: String, required: true },
  price:     { type: Number, required: true },
  qty:       { type: Number, required: true, min: 1 },
  unit:      { type: String, default: '' },
  category:  { type: String, default: '' },
  imageUrl:  { type: String, default: '' },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  note:      { type: String, default: '' },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: String, default: 'system' },
}, { _id: false });

const shopOrderSchema = new mongoose.Schema(
  {
    orderNumber:   { type: String, required: true, unique: true },
    customerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customer:      { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    product:       { type: String, required: true }, // summary string
    items:         { type: [itemSchema], default: [] },
    quantity:      { type: Number, default: 1 },
    amount:        { type: Number, required: true },
    shippingFee:   { type: Number, default: 0 },
    note:          { type: String, default: '' },
    fulfillmentType: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
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
    // PayMongo fields
    paymongoLinkId:      { type: String, default: '' },
    paymongoCheckoutUrl: { type: String, default: '' },
    paymongoPaymentId:   { type: String, default: '' },
    statusHistory: { type: [statusHistorySchema], default: [] },
    orderDate:     { type: Date, default: Date.now },
  },
  { timestamps: true }
);

shopOrderSchema.set('toJSON', { transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('ShopOrder', shopOrderSchema);
