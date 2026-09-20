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
    firstName:    { type: String, required: true, trim: true },
    lastName:     { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: (v) => v === '' || /^09\d{9}$/.test(v),
        message: 'Phone number must be a valid PH mobile number, e.g. 09171234567.',
      },
    },
    addresses:    { type: [addressSchema], default: [] },
    passwordHash: { type: String, select: false }, // absent for Google-only accounts — they never set one

    // ── Google SSO ──
    googleId:      { type: String, unique: true, sparse: true }, // sparse: lets many docs have NO googleId (local accounts)
    authProvider:  { type: String, enum: ['local', 'google'], default: 'local' },
    profileComplete: { type: Boolean, default: true }, // false only for brand-new Google sign-ups missing a phone number

    status:       { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Virtual "name" — kept so every other place that reads/writes
// customer.name (AccountPage's profile edit, admin order views, receipts,
// emails) keeps working unchanged. Getter combines first+last; setter
// splits a single string back into first+last (first word = firstName,
// the rest = lastName) so old code paths that still assign a single
// `name` string continue to work transparently.
customerSchema
  .virtual('name')
  .get(function () {
    return `${this.firstName} ${this.lastName}`.trim();
  })
  .set(function (value) {
    const parts = (value || '').trim().split(/\s+/);
    this.firstName = parts.shift() || '';
    this.lastName = parts.join(' ');
  });

customerSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

customerSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

customerSchema.set('toJSON', {
  virtuals: true, // so serialized customer objects include the computed "name" field
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Customer', customerSchema);
