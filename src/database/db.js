const mongoose = require('mongoose');
const config = require('../config/env');
const logger = require('../utils/logger');

const RETRY_INTERVAL_MS = 5000;
let isShuttingDown = false;

/**
 * Mongoose database connection options.
 * Optimized for production multi-tenant pooling.
 */
const mongooseOptions = {
  maxPoolSize: 50,                // Maintain up to 50 socket connections
  minPoolSize: 10,                // Keep at least 10 socket connections open
  socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Timeout after 5s trying to reach server
  heartbeatFrequencyMS: 10000,    // Send heartbeat every 10s to keep connection alive
};

/**
 * Initializes connection to MongoDB.
 * Implements exponential backoff / retry logic for high availability.
 */
async function connectDB() {
  const dbUrl = config.mongoose.url;
  
  logger.info({ url: dbUrl.replace(/:([^@]+)@/, ':****@') }, 'Connecting to MongoDB...');

  try {
    await mongoose.connect(dbUrl, mongooseOptions);
  } catch (error) {
    logger.error({ err: error }, 'MongoDB initial connection failed. Retrying...');
    
    // Retry connection after interval if not shutting down
    if (!isShuttingDown) {
      setTimeout(connectDB, RETRY_INTERVAL_MS);
    }
  }
}

// Connection Event Listeners
mongoose.connection.on('connected', async () => {
  logger.info('MongoDB connected successfully');
  try {
    const User = require('../models/user.model');
    const adminExists = await User.findOne({ globalRole: 'platform_admin' });
    if (!adminExists) {
      await User.create({
        fullName: 'Platform Admin',
        email: 'admin@menudot.com',
        mobile: '+919999999999',
        passwordHash: 'adminpassword123',
        globalRole: 'platform_admin',
        status: 'active',
        isDeleted: false,
      });
      logger.info('✅ Auto-seeded missing platform admin (admin@menudot.com / adminpassword123)');
    }

    // Auto-seed Developer Bistro for staging/testing
    const Restaurant = require('../models/restaurant.model');
    const bistroExists = await Restaurant.findOne({ slug: 'developer-bistro' });
    if (!bistroExists) {
      let owner = await User.findOne({ email: 'owner_dev_bistro@menudot.com' });
      if (!owner) {
        owner = await User.create({
          fullName: 'Bistro Owner',
          email: 'owner_dev_bistro@menudot.com',
          mobile: '+919999990001',
          passwordHash: 'password123',
          globalRole: 'restaurant_user',
          status: 'active',
          isDeleted: false
        });
      }

      const restaurant = await Restaurant.create({
        name: 'Developer Bistro',
        slug: 'developer-bistro',
        owner: {
          userId: owner._id,
          fullName: owner.fullName,
          email: owner.email,
          mobile: owner.mobile
        },
        outletType: 'dine_in_and_delivery',
        status: 'active',
        location: {
          address: '100 Developer Street, Hitech City',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500081',
          geo: {
            type: 'Point',
            coordinates: [78.43, 17.45]
          }
        },
        menuProfile: {
          foodType: 'both',
          cuisines: ['North Indian', 'Continental'],
          costForTwo: 500
        },
        legal: {
          pan: 'ABCDE1234F',
          gstin: '36ABCDE1234F1Z5',
          fssaiNumber: '12345678901234',
          fssaiExpiry: new Date(Date.now() + 365*24*60*60*1000)
        },
        bank: {
          accountNumber: '1234567890',
          ifsc: 'SBIN0001234'
        },
        schedule: {
          workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
          openTime: '09:00',
          closeTime: '23:00'
        },
        onboarding: {
          stage: 'approved',
          submittedAt: new Date(),
          approvedAt: new Date()
        },
        subscription: {
          plan: 'growth',
          status: 'trial',
          renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      const RestaurantStaff = require('../models/restaurantStaff.model');
      await RestaurantStaff.create({
        userId: owner._id,
        restaurantId: restaurant._id,
        role: 'owner',
        permissions: ['*'],
        screenAccess: ['*'],
        employment: {
          salary: { amount: 0, currency: 'INR', cycle: 'monthly' },
          joinedAt: new Date()
        },
        status: 'active',
        isDeleted: false
      });

      const MenuCategory = require('../models/menuCategory.model');
      const catBurgers = await MenuCategory.create({
        restaurantId: restaurant._id,
        name: 'Burgers',
        slug: 'burgers',
        description: 'Fresh grilled patties in soft buns',
        isActive: true
      });
      const catDrinks = await MenuCategory.create({
        restaurantId: restaurant._id,
        name: 'Beverages',
        slug: 'beverages',
        description: 'Thirst quenchers & mocktails',
        isActive: true
      });

      const MenuItem = require('../models/menuItem.model');
      await MenuItem.create([
        {
          restaurantId: restaurant._id,
          categoryId: catBurgers._id,
          name: 'Classic Cheeseburger',
          description: 'Juicy vegetable patty, cheddar cheese slice, fresh lettuce and pickle onion.',
          price: 189,
          foodType: 'veg',
          isAvailable: true,
          taxRate: 5,
          addOnGroups: [
            {
              name: 'Extra Toppings',
              minSelect: 0,
              maxSelect: 3,
              options: [
                { name: 'Extra Cheese Slice', price: 30, isAvailable: true },
                { name: 'Grilled Mushrooms', price: 40, isAvailable: true },
                { name: 'Jalapenos', price: 20, isAvailable: true }
              ]
            }
          ]
        },
        {
          restaurantId: restaurant._id,
          categoryId: catBurgers._id,
          name: 'Spicy Chicken Burger',
          description: 'Crispy fried chicken breast, spicy cajun sauce, coleslaw & red onions.',
          price: 249,
          foodType: 'non-veg',
          isAvailable: true,
          taxRate: 5
        },
        {
          restaurantId: restaurant._id,
          categoryId: catDrinks._id,
          name: 'Fresh Mint Mojito',
          description: 'Refreshing muddled mint leaves, lime slices, sparkling soda and sugar syrup.',
          price: 119,
          foodType: 'veg',
          isAvailable: true,
          taxRate: 5
        },
        {
          restaurantId: restaurant._id,
          categoryId: catDrinks._id,
          name: 'Iced Latte Coffee',
          description: 'Chilled espresso shot poured over milk and ice cubes with vanilla syrup.',
          price: 149,
          foodType: 'veg',
          isAvailable: true,
          taxRate: 5
        }
      ]);

      const Table = require('../models/table.model');
      await Table.create({
        restaurantId: restaurant._id,
        tableNumber: '1',
        capacity: 4,
        status: 'vacant',
        qrCode: {
          token: 'qr_dev_bistro_1',
          isActive: true
        }
      });
      logger.info('✅ Auto-seeded missing Developer Bistro staging environment, Staff Owner association & Table 1 (qr_dev_bistro_1)');
    }
  } catch (error) {
    logger.error({ err: error }, 'Auto-seeding database failed');
  }
});

mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB connection error encountered');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
  
  // Reconnection is handled automatically by Mongoose for temporary drops,
  // but if the initial connection failed, the retry loop above takes care of it.
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB connection reestablished');
});

/**
 * Returns database health status.
 * States: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting.
 * @returns {object} Health details
 */
function getDBHealth() {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    status: state === 1 ? 'healthy' : 'unhealthy',
    state: states[state] || 'unknown',
  };
}

/**
 * Gracefully shuts down the database connection during process exit.
 */
async function disconnectDB() {
  isShuttingDown = true;
  logger.info('Initiating database graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error during MongoDB graceful shutdown');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  getDBHealth,
};
