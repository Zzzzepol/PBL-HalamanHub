// HalamanHub Server — Product model

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['kg', 'bundle', 'head', 'piece'], default: 'kg' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

// Derived status based on stock level — not stored, computed on read
productSchema.virtual('status').get(function () {
  if (this.stock === 0) return 'out-of-stock';
  if (this.stock <= 8) return 'low-stock';
  return 'in-stock';
});

productSchema.set('toJSON', { virtuals: true, transform: (doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('Product', productSchema);
