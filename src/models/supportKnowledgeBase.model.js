const mongoose = require('mongoose');

const supportKnowledgeBaseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetAudience: {
      type: String,
      enum: ['customer', 'partner', 'both'],
      default: 'both',
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

supportKnowledgeBaseSchema.index({ title: 'text', content: 'text', tags: 'text' });

const SupportKnowledgeBase = mongoose.model(
  'SupportKnowledgeBase',
  supportKnowledgeBaseSchema,
  'support_knowledge_base'
);

module.exports = SupportKnowledgeBase;
