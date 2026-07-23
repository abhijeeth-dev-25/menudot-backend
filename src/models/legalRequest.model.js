const mongoose = require('mongoose');

const legalRequestSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestType: {
      type: String,
      enum: ['legal_name', 'pan', 'gstin', 'fssai', 'bank_account', 'full_compliance_update'],
      required: true,
    },
    currentValues: {
      legalName: { type: String, default: null },
      pan: { type: String, default: null },
      gstin: { type: String, default: null },
      fssaiNumber: { type: String, default: null },
      bankAccount: { type: String, default: null },
      ifsc: { type: String, default: null },
    },
    requestedValues: {
      legalName: { type: String, default: null },
      pan: { type: String, default: null },
      gstin: { type: String, default: null },
      fssaiNumber: { type: String, default: null },
      bankAccount: { type: String, default: null },
      ifsc: { type: String, default: null },
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    documentProofUrls: [
      {
        documentType: { type: String, required: true }, // e.g. 'gst_certificate', 'pan_card', 'cancelled_cheque', 'fssai_license'
        fileUrl: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending_verification', 'approved', 'rejected'],
      default: 'pending_verification',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const LegalRequest = mongoose.model('LegalRequest', legalRequestSchema, 'legal_requests');

module.exports = LegalRequest;
