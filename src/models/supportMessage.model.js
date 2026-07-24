const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ['customer', 'partner', 'agent', 'system'],
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true,
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema, 'support_messages');

module.exports = SupportMessage;
