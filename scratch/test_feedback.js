const mongoose = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/mongoose');
const dotenv = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/dotenv');

// Load env variables
dotenv.config({ path: '/Users/abhijeethkar/Desktop/menudot-backend/.env' });

const config = require('/Users/abhijeethkar/Desktop/menudot-backend/src/config/env');
const User = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/user.model');
const Restaurant = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurant.model');
const RestaurantStaff = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurantStaff.model');
const Feedback = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/feedback.model');
const PlatformIntegration = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/platformIntegration.model');
const Order = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/order.model');

const API_URL = 'http://localhost:5050/api/v1';

async function runFeedbackTests() {
  console.log('--- STARTING BACKEND PHASE 4 (REPUTATION & FEEDBACKS) VERIFICATION ---');

  // 1. CONNECT TO MONGO
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection failed in test script:', err);
    process.exit(1);
  }

  const testOwnerEmail = 'feedback_owner_test@menudot.com';
  const testManagerEmail = 'feedback_mgr_test@menudot.com';
  const testChefEmail = 'feedback_chef_test@menudot.com';

  let ownerToken = '';
  let managerToken = '';
  let chefToken = '';
  let restaurantId = '';
  let managerUserId = '';
  let pendingComplaintId = '';
  let orderId = '';

  // 2. SEED CLEAN RESTAURANT, OWNER, STAFF, PLATFORMINTEGRATIONS, AND ORDERS
  try {
    // Clean old test runs
    const oldUsers = await User.find({ email: { $in: [testOwnerEmail, testManagerEmail, testChefEmail] } });
    const userIds = oldUsers.map(u => u._id);
    if (userIds.length > 0) {
      await Restaurant.deleteMany({ 'owner.userId': { $in: userIds } });
      await RestaurantStaff.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    // Create owner
    const owner = new User({
      fullName: 'Feedback Test Owner',
      email: testOwnerEmail,
      mobile: '+919999966661',
      passwordHash: 'ownerpassword123',
      status: 'active',
    });
    await owner.save();

    // Create manager
    const manager = new User({
      fullName: 'Feedback Test Manager',
      email: testManagerEmail,
      mobile: '+919999966662',
      passwordHash: 'mgrpassword123',
      status: 'active',
    });
    await manager.save();
    managerUserId = manager._id.toString();

    // Create chef
    const chef = new User({
      fullName: 'Feedback Test Chef',
      email: testChefEmail,
      mobile: '+919999966663',
      passwordHash: 'chefpassword123',
      status: 'active',
    });
    await chef.save();

    // Create restaurant
    const restaurant = new Restaurant({
      name: 'Feedback Test Cafe',
      slug: 'feedback-test-cafe',
      owner: {
        userId: owner._id,
        fullName: 'Feedback Test Owner',
        email: testOwnerEmail,
        mobile: '+919999966661',
      },
      location: {
        address: 'Banjara Hills Rd 12',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500034',
        geo: { type: 'Point', coordinates: [78.43, 17.42] },
      },
      schedule: {
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        openTime: '08:00',
        closeTime: '23:00',
      },
      outletType: 'dine_in_and_delivery',
      legal: {
        pan: 'ABCDE6666Z',
        gstin: '36ABCDE6666Z1Z7',
        fssaiNumber: '99887766553322',
        fssaiExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      bank: {
        ifsc: 'SBIN0006666',
        accountNumber: '999888333444',
      },
      menuProfile: {
        foodType: 'both',
        cuisines: ['Indian'],
        costForTwo: 400,
      },
      onboarding: { stage: 'approved', approvedAt: new Date() },
    });
    await restaurant.save();
    restaurantId = restaurant._id.toString();

    // Map staff joins
    await new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: owner._id,
      role: 'owner',
      permissions: ['*'],
      status: 'active',
    }).save();

    await new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: manager._id,
      role: 'manager',
      permissions: ['*'],
      status: 'active',
    }).save();

    await new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: chef._id,
      role: 'chef',
      permissions: ['menu_read'],
      status: 'active',
    }).save();

    // Clear old feedbacks, integrations, and orders for this restaurant
    await Feedback.deleteMany({ restaurantId });
    await PlatformIntegration.deleteMany({ restaurantId });
    await Order.deleteMany({ restaurantId });

    // Seed Order
    const testOrder = new Order({
      restaurantId,
      orderNumber: 'FEED-ORD-901',
      orderSource: 'dine_in',
      status: 'completed',
      totals: { subtotal: 500, tax: 25, grandTotal: 525 },
    });
    await testOrder.save();
    orderId = testOrder._id.toString();

    // Seed Zomato platform integration (status: active) using the service to encrypt credentials
    const PlatformIntegrationService = require('/Users/abhijeethkar/Desktop/menudot-backend/src/services/platformIntegration.service');
    await PlatformIntegrationService.configureIntegration(restaurantId, {
      platform: 'zomato',
      externalRestaurantId: 'ZOM-REP-123',
      credentials: {
        accessToken: 'zomato_access_token',
        refreshToken: 'zomato_refresh_token',
        expiresAt: new Date('2026-12-31T23:59:59.000Z'),
      },
      syncSettings: { menuSync: true, orderSync: true, autoAcceptOrders: true },
    });

    console.log('Seeded clean Reputation Test Cafe, staff, order, and active Zomato integration.');
  } catch (err) {
    console.error('Failed to seed reputation test details:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 3. LOG IN USERS
  try {
    // Owner
    let loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testOwnerEmail, password: 'ownerpassword123' }),
    });
    let loginData = await loginRes.json();
    ownerToken = loginData.data.tokens.accessToken;

    // Manager
    loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testManagerEmail, password: 'mgrpassword123' }),
    });
    loginData = await loginRes.json();
    managerToken = loginData.data.tokens.accessToken;

    // Chef
    loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testChefEmail, password: 'chefpassword123' }),
    });
    loginData = await loginRes.json();
    chefToken = loginData.data.tokens.accessToken;

    console.log('Logged in test users.');
  } catch (err) {
    console.error('Login failed:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 4. VERIFY PUBLIC CUSTOMER FEEDBACK SUBMISSION
  try {
    // 1st feedback: rating 2 (complaint)
    let response = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        customerName: 'Sam ColdFood',
        rating: 2,
        comment: 'French fries were cold.',
        orderId,
      }),
    });

    let data = await response.json();
    console.log('1. Public Feedback Submission Status:', response.status);
    console.log('   Is Complaint Flagged:', data.data?.isComplaint);
    console.log('   Complaint Status:', data.data?.status);

    if (response.status !== 201 || data.data?.isComplaint !== true || data.data?.status !== 'pending') {
      throw new Error('Public complaint submission mapping failed');
    }
    pendingComplaintId = data.data?._id;

    // 2nd feedback: rating 1 (escalated to owner)
    response = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        customerName: 'Angry Customer',
        rating: 1,
        comment: 'Found hair in salad!',
      }),
    });

    data = await response.json();
    console.log('2. Public Escalation Feedback Status:', response.status);
    console.log('   Escalated to Owner Flag:', data.data?.escalatedToOwner);

    if (response.status !== 201 || data.data?.escalatedToOwner !== true) {
      throw new Error('Public critical escalation mapping failed');
    }
  } catch (err) {
    console.error('Public Submission Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 5. VERIFY STAFF ROLE PRIVACY
  try {
    // Chef reads logs (should pass)
    let response = await fetch(`${API_URL}/feedback`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${chefToken}`, 'x-restaurant-id': restaurantId },
    });
    console.log('3. Chef Read Logs Status:', response.status);
    if (response.status !== 200) {
      throw new Error('Chef was blocked from reading reviews');
    }

    // Chef resolves complaint (should be blocked)
    response = await fetch(`${API_URL}/feedback/${pendingComplaintId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chefToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        status: 'resolved',
        resolutionNotes: 'Chef tried resolving but should fail.',
      }),
    });
    console.log('4. Chef Resolve Complaint Status (expected 403):', response.status);
    if (response.status !== 403) {
      throw new Error('Security check failed: Chef allowed to resolve complaints!');
    }
  } catch (err) {
    console.error('Staff Role Boundary Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 6. VERIFY COMPLAINT RESOLUTION (Manager resolves pendingComplaintId)
  try {
    const response = await fetch(`${API_URL}/feedback/${pendingComplaintId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        status: 'resolved',
        resolutionNotes: 'Spoke with chef. Issued refund to Sam.',
      }),
    });

    const data = await response.json();
    console.log('5. Manager Resolve Complaint Status:', response.status);
    console.log('   New Status Value:', data.data?.status);
    console.log('   Resolved By User ID:', data.data?.resolvedBy);
    console.log('   Resolution Notes:', data.data?.resolutionNotes);

    if (response.status !== 200 || data.data?.status !== 'resolved' || data.data?.resolvedBy !== managerUserId) {
      throw new Error('Manager resolve complaint update assertion failed');
    }
  } catch (err) {
    console.error('Complaint Resolution Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 7. VERIFY ZOMATO SYNC & IDEMPOTENCY
  try {
    // 1st Sync
    let response = await fetch(`${API_URL}/feedback/sync/zomato`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}`, 'x-restaurant-id': restaurantId },
    });
    let data = await response.json();
    console.log('6. Zomato Reviews Sync 1 Status:', response.status);
    console.log('   Reviews Synced Count:', data.data?.syncedCount);

    if (response.status !== 200 || data.data?.syncedCount !== 3) {
      throw new Error('Zomato sync review count mismatch');
    }

    // 2nd Sync (idempotency check: should return 0 synced items)
    response = await fetch(`${API_URL}/feedback/sync/zomato`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}`, 'x-restaurant-id': restaurantId },
    });
    data = await response.json();
    console.log('7. Zomato Reviews Sync 2 Status (Idempotency):', response.status);
    console.log('   Reviews Synced Count:', data.data?.syncedCount);

    if (response.status !== 200 || data.data?.syncedCount !== 0) {
      throw new Error('Idempotency checks failed: duplicate Zomato reviews synced!');
    }
  } catch (err) {
    console.error('Zomato Sync Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 8. VERIFY ANALYTICS REPORT
  try {
    const response = await fetch(`${API_URL}/feedback/analytics`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-restaurant-id': restaurantId },
    });

    const data = await response.json();
    const stats = data.data;

    console.log('8. Retrieve Feedback Analytics Dashboard:');
    console.log('   Total Reviews:', stats?.totalReviews);
    console.log('   Average Rating:', stats?.averageRating);
    console.log('   Positive Reviews %:', stats?.positiveReviewPercentage);
    console.log('   Total Complaints count:', stats?.complaintsCount);
    console.log('   Resolved Complaints:', stats?.complaintsByStatus?.resolved);
    console.log('   Pending Complaints:', stats?.complaintsByStatus?.pending);

    // Expected reviews = 5 (2 internal [Sam + Angry] + 3 Zomato)
    // Expected average = (2 + 1 + 5 + 1 + 4) / 5 = 13 / 5 = 2.6
    // Expected complaints count = 3 (Sam [2], Angry [1], Zomato-2 [1])
    // Resolved complaints count = 1 (Sam resolved)
    // Pending complaints count = 2 (Angry, Zomato-2)

    if (
      stats?.totalReviews !== 5 ||
      stats?.averageRating !== 2.6 ||
      stats?.complaintsCount !== 3 ||
      stats?.complaintsByStatus?.resolved !== 1 ||
      stats?.complaintsByStatus?.pending !== 2
    ) {
      throw new Error('Analytics report calculation results verification failed!');
    }
  } catch (err) {
    console.error('Analytics Dashboard Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('--- ALL REPUTATION & FEEDBACK TESTS COMPLETED SUCCESSFULLY ---');
}

runFeedbackTests();
