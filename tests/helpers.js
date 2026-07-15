// Set test environment variables BEFORE importing config or any models
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/menudot_test';
process.env.MONGODB_USE_TRANSACTIONS = 'false';

const mongoose = require('mongoose');
const { connectDB } = require('../src/database/db');
const User = require('../src/models/user.model');
const Restaurant = require('../src/models/restaurant.model');
const RestaurantStaff = require('../src/models/restaurantStaff.model');
const Screen = require('../src/models/screen.model');
const { generateAccessToken } = require('../src/utils/jwt.util');

// Mock nodemailer globally for tests to avoid SMTP connections
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-email-id' }),
  }),
}));

/**
 * Connect to test database and reset it.
 */
async function setupTestDB() {
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }
  // Clear any existing database state
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
}

/**
 * Close database connection.
 */
async function cleanupTestDB() {
  await mongoose.connection.close();
}

/**
 * Clear all collections between test runs to avoid interference.
 */
async function clearDBCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Seeds a default platform admin.
 */
async function createPlatformAdmin() {
  const adminData = {
    fullName: 'Platform Admin',
    email: 'admin@menudot.com',
    mobile: '+919999999999',
    passwordHash: 'adminpassword123', // will be hashed by pre-save
    globalRole: 'platform_admin',
    status: 'active',
  };

  const admin = new User(adminData);
  await admin.save();

  const token = generateAccessToken(admin, 'user');
  return {
    user: admin,
    token,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * Registers and approves a test restaurant.
 * @param {string} adminToken - Platform Admin Access Token
 */
async function registerAndApproveRestaurant(adminToken) {
  // 1. Create owner and restaurant in DB simulating registration
  const owner = new User({
    fullName: 'Test Owner',
    email: 'owner@testrestaurant.com',
    mobile: '+918888888888',
    passwordHash: 'ownerpassword123',
    globalRole: 'restaurant_user',
    status: 'active', // Approved owner is active
  });
  await owner.save();

  const restaurant = new Restaurant({
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    owner: {
      userId: owner._id,
      fullName: owner.fullName,
      email: owner.email,
      mobile: owner.mobile,
    },
    location: {
      address: '123 Test St',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      geo: { type: 'Point', coordinates: [78.4, 17.4] },
    },
    schedule: {
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      openTime: '11:00',
      closeTime: '23:00',
    },
    outletType: 'dine_in_and_delivery',
    legal: {
      pan: 'ABCDE1234F',
      gstin: '36ABCDE1234F1Z5',
      fssaiNumber: '12345678901234',
      fssaiExpiry: '2028-12-31',
    },
    bank: {
      ifsc: 'SBIN0001234',
      accountNumber: '987654321012',
    },
    menuProfile: {
      foodType: 'both',
      cuisines: ['Indian'],
      costForTwo: 500,
    },
    onboarding: {
      stage: 'approved',
      submittedAt: new Date(),
      approvedAt: new Date(),
    },
    subscription: {
      status: 'trial',
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await restaurant.save();

  // 2. Map Owner in Restaurant Staff
  const staffRole = new RestaurantStaff({
    restaurantId: restaurant._id,
    userId: owner._id,
    role: 'owner',
    permissions: ['*'],
    screenAccess: ['*'],
    status: 'active',
  });
  await staffRole.save();

  const token = generateAccessToken(owner, 'user');
  return {
    restaurant,
    owner,
    token,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-restaurant-id': restaurant._id.toString(),
    },
  };
}

async function createPendingRestaurant(owner) {
  const restaurant = new Restaurant({
    name: 'Pending Diner',
    slug: 'pending-diner',
    owner: {
      userId: owner._id,
      fullName: owner.fullName,
      email: owner.email,
      mobile: owner.mobile,
    },
    location: {
      address: '123 Test St',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      geo: { type: 'Point', coordinates: [78.4, 17.4] },
    },
    schedule: {
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      openTime: '11:00',
      closeTime: '23:00',
    },
    outletType: 'dine_in_and_delivery',
    legal: {
      pan: 'ABCDE1234F',
      gstin: '36ABCDE1234F1Z5',
      fssaiNumber: '12345678901234',
      fssaiExpiry: '2028-12-31',
    },
    bank: {
      ifsc: 'SBIN0001234',
      accountNumber: '987654321012',
    },
    menuProfile: {
      foodType: 'both',
      cuisines: ['Indian'],
      costForTwo: 500,
    },
    onboarding: {
      stage: 'submitted',
      submittedAt: new Date(),
    },
    subscription: {
      status: 'suspended',
    },
  });
  await restaurant.save();
  return restaurant;
}

module.exports = {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  createPlatformAdmin,
  registerAndApproveRestaurant,
  createPendingRestaurant,
};
