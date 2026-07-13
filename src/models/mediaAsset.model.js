const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const mediaAssetSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true,
  },
  fileId: {
    type: String,
    required: true, // ImageKit file ID used to call deletion API
    trim: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number, // File size in bytes
    required: true,
  },
});

// Register auditable plugin for tenancy and timestamps
mediaAssetSchema.plugin(auditablePlugin);

const MediaAsset = mongoose.model('MediaAsset', mediaAssetSchema);

module.exports = MediaAsset;
