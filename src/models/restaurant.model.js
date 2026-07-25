const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/fieldEncryption.util');

const restaurantSchema = new mongoose.Schema(
  {
    chainId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: 'RestaurantChain', // future expansion
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'closed', 'suspended'],
      default: 'active',
      index: true,
    },
    owner: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      mobile: { type: String, required: true },
      whatsapp: { type: String, default: null },
    },
    location: {
      address: { type: String, required: true },
      geo: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
      },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    schedule: {
      workingDays: {
        type: [String],
        enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        required: true,
      },
      openTime: { type: String, required: true }, // "HH:MM" 24h format
      closeTime: { type: String, required: true },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    outletType: {
      type: String,
      enum: ['dine_in_and_delivery', 'dine_in_only', 'delivery_only'],
      required: true,
    },
    legal: {
      pan: {
        type: String,
        required: true,
        set: encrypt,
        get: decrypt,
      },
      gstin: {
        type: String,
        required: true,
        set: encrypt,
        get: decrypt,
      },
      fssaiNumber: {
        type: String,
        required: true,
        set: encrypt,
        get: decrypt,
      },
      fssaiExpiry: {
        type: Date,
        required: true,
      },
    },
    bank: {
      ifsc: {
        type: String,
        required: true,
        set: encrypt,
        get: decrypt,
      },
      accountNumber: {
        type: String,
        required: true,
        set: encrypt,
        get: decrypt,
      },
    },
    menuProfile: {
      foodType: {
        type: String,
        enum: ['veg_only', 'both'],
        required: true,
      },
      cuisines: {
        type: [String],
        required: true,
      },
      costForTwo: {
        type: Number,
        required: true,
      },
      packingCharge: {
        type: {
          type: String,
          enum: ['flat', 'percent', 'none'],
          default: 'none',
        },
        value: {
          type: Number,
          default: 0,
        },
      },
    },
    ratingsSummary: {
      overallRating: { type: Number, default: 5.0, min: 0, max: 5 },
      serviceRating: { type: Number, default: 5.0, min: 0, max: 5 },
      foodQualityRating: { type: Number, default: 5.0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0, min: 0 },
    },
    commercials: {
      commissionPercent: { type: Number, default: 0 },
      onboardingFeePaid: { type: Boolean, default: false },
      termsAcceptedAt: { type: Date, default: null },
      termsVersion: { type: String, default: 'v1' },
    },
    onboarding: {
      stage: {
        type: String,
        enum: ['draft', 'pending_payment', 'submitted', 'under_review', 'pending_approval', 'verified', 'approved', 'rejected'],
        default: 'pending_payment',
        index: true,
      },
      securityFeePaid: { type: Boolean, default: false },
      feePaymentId: { type: String, default: null },
      feeAmount: { type: Number, default: 1950 },
      submittedAt: { type: Date, default: null },
      verificationChecklist: {
        panVerified: { type: Boolean, default: false },
        gstinVerified: { type: Boolean, default: false },
        fssaiVerified: { type: Boolean, default: false },
        bankVerified: { type: Boolean, default: false },
      },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null },
      approvedAt: { type: Date, default: null },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      rejectionReason: { type: String, default: null },
    },
    subscription: {
      plan: {
        type: String,
        enum: ['starter', 'growth', 'enterprise'],
        default: 'starter',
      },
      status: {
        type: String,
        enum: ['active', 'suspended', 'trial'],
        default: 'trial',
      },
      renewsAt: { type: Date, default: null },
    },
    imageUrl: {
      type: String,
      default: null,
    },
    branches: [
      {
        name: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, trim: true },
        googleMapsUrl: { type: String, default: '', trim: true },
        isMainBranch: { type: Boolean, default: false },
        isOpen: { type: Boolean, default: true },
        timings: { type: String, default: '10:00 AM - 11:00 PM', trim: true },
      },
    ],
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
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Geo index for spatial queries
restaurantSchema.index({ 'location.geo': '2dsphere' });

// Pre-save hook: increment version and auto-generate slug if needed
restaurantSchema.pre('save', function (next) {
  if (!this.isNew) {
    this.version = (this.version || 0) + 1;
  }
  
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  
  next();
});

// Query middleware to exclude soft-deleted restaurants
restaurantSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeDeleted === true) {
    return next();
  }
  this.where({ isDeleted: false });
  next();
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

module.exports = Restaurant;
