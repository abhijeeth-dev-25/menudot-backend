const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const experienceServiceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['dining', 'nightlife_bar', 'buffet', 'rooms_stay', 'events_music', 'amenities', 'other'],
      required: true,
      default: 'dining',
      index: true,
    },
    tagline: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    iconName: {
      type: String,
      default: 'Utensils',
      trim: true,
    },
    highlights: [
      {
        type: String,
        trim: true,
      },
    ],
    timing: {
      type: String,
      default: '',
      trim: true,
    },
    priceStartingFrom: {
      type: Number,
      default: null,
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

experienceServiceSchema.plugin(auditablePlugin);

const ExperienceService = mongoose.model(
  'ExperienceService',
  experienceServiceSchema,
  'experience_services'
);

module.exports = ExperienceService;
