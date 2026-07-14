const mongoose = require('mongoose');
const auditablePlugin = require('./plugins/auditable.plugin');

const prepaymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['none', 'pending', 'paid', 'refunded'],
    default: 'none',
  },
  transactionId: {
    type: String,
    default: null,
  },
}, { _id: false });

const sourceSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['internal', 'swiggy', 'zomato'],
    default: 'internal',
  },
  externalBookingId: {
    type: String,
    default: null,
    index: true,
  },
}, { _id: false });

const bookingSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      default: null,
    },
    tableNumber: {
      type: String,
      default: null,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerMobile: {
      type: String,
      required: true,
      trim: true,
    },
    numberOfPeople: {
      type: Number,
      required: true,
      min: 1,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{2}:\d{2}$/, 'Please use HH:MM format for timeSlot'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
      default: 'confirmed',
      index: true,
    },
    prepayment: {
      type: prepaymentSchema,
      default: () => ({}),
    },
    source: {
      type: sourceSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Apply tenant & audit plugin
bookingSchema.plugin(auditablePlugin);

// Compound index to prevent double bookings on same table + slot + date
bookingSchema.index(
  { tableId: 1, bookingDate: 1, timeSlot: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { tableId: { $exists: true }, status: 'confirmed' },
  }
);

// Compound index to prevent double bookings on same tableNumber + slot + date
bookingSchema.index(
  { tableNumber: 1, bookingDate: 1, timeSlot: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { tableNumber: { $type: 'string' }, status: 'confirmed' },
  }
);

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
