const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const feedbackSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['internal', 'swiggy', 'zomato'],
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    customerName: {
      type: String,
      default: 'Anonymous',
      trim: true,
    },
    customerMobile: {
      type: String,
      default: null,
      trim: true,
    },
    comment: {
      type: String,
      default: null,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    externalReviewId: {
      type: String,
      default: null,
      index: true,
    },
    isComplaint: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'ignored'],
      default: 'pending',
      index: true,
    },
    resolutionNotes: {
      type: String,
      default: null,
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    escalatedToOwner: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
feedbackSchema.plugin(auditablePlugin);

// Compound unique partial index to prevent duplicate reviews synced from Swiggy/Zomato
feedbackSchema.index(
  { restaurantId: 1, source: 1, externalReviewId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReviewId: { $type: 'string' } },
  }
);

// General compound lookup indexes
feedbackSchema.index({ restaurantId: 1, status: 1, isComplaint: 1 });

const Feedback = mongoose.model('Feedback', feedbackSchema, 'feedbacks');

module.exports = Feedback;
