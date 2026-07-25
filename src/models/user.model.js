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

const config = require('../config/env');
const getFounderEmail = () => (config.founder?.email || process.env.FOUNDER_EMAIL || 'abhijeethkar.geddam.dev@gmail.com').toLowerCase();

// Pre-save hook: hash password, enforce Founder protections, and increment version
userSchema.pre('save', async function (next) {
  const user = this;
  const founderEmail = getFounderEmail();

  // Immutable Founder Account Protections
  if (user.email && user.email.toLowerCase() === founderEmail) {
    user.globalRole = 'super_admin';
    user.status = 'active';
    user.isDeleted = false;
    user.deletedAt = null;
  }

  if (user.isModified('passwordHash')) {
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(user.passwordHash, salt);
  }

  if (!user.isNew) {
    user.version = (user.version || 0) + 1;
  }

  next();
});

// Guard against queries attempting to soft-delete or suspend Founder Account
userSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function (next) {
  const update = this.getUpdate();
  const filter = this.getFilter();
  const founderEmail = getFounderEmail();
  const isFounderTarget = filter.email === founderEmail || filter.email === founderEmail.toLowerCase();

  if (isFounderTarget && !this.getOptions().isFounderOtpAuthorized) {
    if (update) {
      if (update.isDeleted === true || update.$set?.isDeleted === true) {
        return next(new Error(`Founder account (${founderEmail}) is immutable and cannot be deleted.`));
      }
      if (update.status === 'suspended' || update.$set?.status === 'suspended') {
        return next(new Error(`Founder account (${founderEmail}) status cannot be suspended.`));
      }
      if (update.globalRole && update.globalRole !== 'super_admin') {
        return next(new Error('Founder account role cannot be demoted from super_admin.'));
      }
      if (update.$set?.globalRole && update.$set?.globalRole !== 'super_admin') {
        return next(new Error('Founder account role cannot be demoted from super_admin.'));
      }
    }
  }
  next();
});

// Guard against hard deletion of Founder Account
userSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove'], function (next) {
  const filter = this.getFilter();
  const founderEmail = getFounderEmail();
  if (filter && (filter.email === founderEmail || filter.email === founderEmail.toLowerCase()) && !this.getOptions().isFounderOtpAuthorized) {
    return next(new Error(`Founder account (${founderEmail}) is immutable and cannot be deleted.`));
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
