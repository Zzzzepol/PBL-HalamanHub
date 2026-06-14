const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user:     { type: String, required: true }, // name of who did it
    userId:   { type: String, default: '' },    // their MongoDB _id
    action:   { type: String, required: true }, // what they did
    category: { 
      type: String, 
      enum: ['auth', 'products', 'orders', 'users', 'irrigation', 'settings', 'sensors'],
      default: 'auth'
    },
    details:  { type: String, default: '' },    // extra info
    status:   { type: String, enum: ['success', 'failed'], default: 'success' },
  },
  { timestamps: true }
);

activityLogSchema.set('toJSON', { 
  transform: (doc, ret) => { delete ret.__v; return ret; } 
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);