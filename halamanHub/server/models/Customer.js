// HalamanHub Server — Customer model
// Separate from admin/staff User model
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    label:     { type: String, default: 'Home', trim: true },
    address:   { type: String, required: true, trim: true }, // House/Unit No., Street, Barangay
    city:      { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const customerSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: (v) => v === '' || /^\+639\d{9}$/.test(v),
        message: 'Phone number must be a valid PH mobile number, e.g. +639171234567.',
      },
    },
    addresses:    { type: [addressSchema], default: [] },
    passwordHash: { type: String, select: false },
    status:       { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

customerSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

customerSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

customerSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Customer', customerSchema);
