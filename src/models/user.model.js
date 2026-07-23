const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      private: true, // Will be deleted when serialized to JSON
    },
    authProviders: [
      {
        provider: {
          type: String,
          required: true,
          enum: ['menudot', 'swiggy', 'zomato'],
        },
        providerId: {
          type: String,
          required: true,
        },
      },
    ],
    globalRole: {
      type: String,
      enum: [
        'restaurant_user',
        'super_admin',
        'platform_admin',
        'operations',
        'verification',
        'finance',
        'support',
        'safety',
        'sales',
        'tech',
        'audit',
      ],
      default: 'restaurant_user',
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: hash password and increment version on updates
userSchema.pre('save', async function (next) {
  const user = this;

  if (user.isModified('passwordHash')) {
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
  }

  if (!user.isNew) {
    user.version = (user.version || 0) + 1;
  }

  next();
});

// Instance method to check password validity
userSchema.methods.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Global query filter to exclude soft-deleted users
userSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeDeleted === true) {
    return next();
  }
  this.where({ isDeleted: false });
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
