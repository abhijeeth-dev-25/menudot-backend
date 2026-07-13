const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const auditablePlugin = require('./plugins/auditable.plugin');

const screenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    screenType: {
      type: String,
      enum: ['kitchen_display', 'cashier', 'server', 'owner', 'reception'],
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      private: true,
    },
    assignedRole: {
      type: String,
      enum: ['owner', 'manager', 'server', 'chef'],
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    allowedServices: {
      type: [String],
      default: ['water', 'bill', 'cleaning', 'queries', 'others'],
    },
    allowedTables: {
      type: [String],
      default: [], // Empty means all tables
    },
    assignedStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    // Options
  }
);

// Apply tenant & audit plugin
screenSchema.plugin(auditablePlugin);

// Unique index for username within a restaurant
screenSchema.index({ restaurantId: 1, username: 1 }, { unique: true });

// Pre-save hook to hash device password
screenSchema.pre('save', async function (next) {
  const screen = this;

  if (screen.isModified('passwordHash')) {
    const salt = await bcrypt.genSalt(10);
    screen.passwordHash = await bcrypt.hash(screen.passwordHash, salt);
  }

  next();
});

// Instance method to check password validity
screenSchema.methods.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

const Screen = mongoose.model('Screen', screenSchema);

module.exports = Screen;
