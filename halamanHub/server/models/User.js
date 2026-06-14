// ============================================================
// HalamanHub Server — User model
// Roles: admin, staff only (no customer accounts)
// ============================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    username:     { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    role:         { type: String, enum: ['admin', 'staff'], default: 'staff' },
    status:       { type: String, enum: ['active', 'inactive'], default: 'active' },
    initials:     { type: String, trim: true },
    color:        { type: String, default: '#1a6b3a' },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
};

userSchema.methods.verifyPassword = async function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
