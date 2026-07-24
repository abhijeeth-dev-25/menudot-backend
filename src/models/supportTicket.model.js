const mongoose = require('mongoose');

const refundDetailsSchema = new mongoose.Schema(
  {
    requestedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
      index: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requesterType: {
      type: String,
      enum: ['customer', 'partner_owner', 'partner_staff'],
      required: true,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    requesterName: {
      type: String,
      required: true,
      trim: true,
    },
    requesterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    requesterMobile: {
      type: String,
      default: null,
      trim: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'refund_order',
        'food_quality',
        'billing_payout',
        'kyc_verification',
        'technical_bug',
        'account_login',
        'general',
      ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'waiting_user', 'resolved', 'closed', 'reopened'],
      default: 'open',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAgentName: {
      type: String,
      default: 'Unassigned',
    },
    slaDueDate: {
      type: Date,
      default: null,
    },
    slaBreached: {
      type: Boolean,
      default: false,
      index: true,
    },
    refundDetails: {
      type: refundDetailsSchema,
      default: () => ({}),
    },
    resolutionNotes: {
      type: String,
      default: null,
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema, 'support_tickets');

module.exports = SupportTicket;
