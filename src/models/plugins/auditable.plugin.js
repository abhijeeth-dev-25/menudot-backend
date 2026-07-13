const mongoose = require('mongoose');

/**
 * Reusable Mongoose plugin to inject tenancy, soft delete, audit fields,
 * and optimistic concurrency properties.
 * 
 * @param {mongoose.Schema} schema - The Mongoose schema instance
 */
function auditablePlugin(schema) {
  schema.add({
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
  });

  // Enable standard createdAt/updatedAt Mongoose timestamps
  schema.set('timestamps', true);

  // Pre-save hook to increment version on updates
  schema.pre('save', function (next) {
    if (!this.isNew) {
      this.version = (this.version || 0) + 1;
    }
    next();
  });

  // Query middleware: filter out soft-deleted documents by default
  schema.pre(/^find/, function (next) {
    // Skip if query explicitly asks to include deleted records
    if (this.getOptions().includeDeleted === true) {
      return next();
    }
    
    this.where({ isDeleted: false });
    next();
  });

  // Aggregate middleware: filter out soft-deleted documents from aggregations
  schema.pre('aggregate', function (next) {
    const pipeline = this.pipeline();
    
    // Check if the pipeline already specifies an isDeleted match
    const hasIsDeletedMatch = pipeline.some(
      (stage) => stage.$match && stage.$match.isDeleted !== undefined
    );

    if (!hasIsDeletedMatch) {
      pipeline.unshift({ $match: { isDeleted: false } });
    }
    
    next();
  });
}

module.exports = auditablePlugin;
