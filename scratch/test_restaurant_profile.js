const mongoose = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/mongoose');
const dotenv = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/dotenv');

// Load env variables
dotenv.config({ path: '/Users/abhijeethkar/Desktop/menudot-backend/.env' });

const config = require('/Users/abhijeethkar/Desktop/menudot-backend/src/config/env');
const User = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/user.model');
const Restaurant = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurant.model');
const RestaurantStaff = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurantStaff.model');

const API_URL = 'http://localhost:5050/api/v1';

async function runProfileTests() {
  console.log('--- STARTING BACKEND RESTAURANT PROFILE & ADMIN DELETION VERIFICATION ---');

  // 1. CONNECT TO MONGO
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection failed in test script:', err);
    process.exit(1);
  }

  const testOwnerEmail = 'profile_owner_test@menudot.com';
  const testAdminEmail = 'platform_admin_test@menudot.com';

  let ownerToken = '';
  let adminToken = '';
  let restaurantId = '';

  // 2. SEED CLEAN DATA
  try {
    // Clean old test runs
    const oldUsers = await User.find({ email: { $in: [testOwnerEmail, testAdminEmail] } });
    const userIds = oldUsers.map(u => u._id);
    if (userIds.length > 0) {
      await Restaurant.deleteMany({ 'owner.userId': { $in: userIds } });
      await RestaurantStaff.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    // Create Owner
    const owner = new User({
      fullName: 'Profile Test Owner',
      email: testOwnerEmail,
      mobile: '+919999988881',
      passwordHash: 'ownerpassword123',
      status: 'active',
    });
    await owner.save();

    // Create Platform Admin
    const admin = new User({
      fullName: 'Platform Developer',
      email: testAdminEmail,
      mobile: '+919999988882',
      passwordHash: 'adminpassword123',
      globalRole: 'platform_admin',
      status: 'active',
    });
    await admin.save();

    // Create Restaurant
    const restaurant = new Restaurant({
      name: 'Original Pizza Place',
      slug: 'original-pizza-place',
      owner: {
        userId: owner._id,
        fullName: 'Profile Test Owner',
        email: testOwnerEmail,
        mobile: '+919999988881',
      },
      location: {
        address: 'Banjara Hills Rd 2',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500034',
        geo: { type: 'Point', coordinates: [78.41, 17.42] },
      },
      schedule: {
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        openTime: '09:00',
        closeTime: '22:00',
      },
      outletType: 'dine_in_and_delivery',
      legal: {
        pan: 'ABCDE9999Z',
        gstin: '36ABCDE9999Z1Z5',
        fssaiNumber: '99887766554422',
        fssaiExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      bank: {
        ifsc: 'SBIN0009999',
        accountNumber: '999888555666',
      },
      menuProfile: {
        foodType: 'both',
        cuisines: ['Indian'],
        costForTwo: 300,
      },
      onboarding: { stage: 'approved', approvedAt: new Date() },
    });
    await restaurant.save();
    restaurantId = restaurant._id.toString();

    // Map Staff
    await new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: owner._id,
      role: 'owner',
      permissions: ['*'],
      status: 'active',
    }).save();

    console.log('Seeded clean restaurant profile and platform admin.');
  } catch (err) {
    console.error('Failed to seed profile test details:', err);
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

    // Platform Admin
    loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testAdminEmail, password: 'adminpassword123' }),
    });
    loginData = await loginRes.json();
    adminToken = loginData.data.tokens.accessToken;

    console.log('Logged in test users.');
  } catch (err) {
    console.error('Login failed:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 4. VERIFY UPDATE PROFILE (Owner adds image and updates name)
  try {
    const updatedImageUrl = 'https://ik.imagekit.io/76mebnnttc/test_uploads/restaurant.png';
    const response = await fetch(`${API_URL}/restaurants/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        name: 'Updated Pizza Hub',
        imageUrl: updatedImageUrl,
      }),
    });

    const data = await response.json();
    console.log('1. Owner Profile Update Status:', response.status);
    console.log('   Updated Restaurant Name:', data.data?.name);
    console.log('   Updated Restaurant Image URL:', data.data?.imageUrl);

    if (response.status !== 200 || data.data?.name !== 'Updated Pizza Hub' || data.data?.imageUrl !== updatedImageUrl) {
      throw new Error('Update restaurant profile details mismatch');
    }
  } catch (err) {
    console.error('Update Profile Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 5. VERIFY DELETE RESTAURANT ACCOUNT (Platform Admin)
  try {
    const response = await fetch(`${API_URL}/restaurants/admin/${restaurantId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    console.log('2. Admin Delete Restaurant Status:', response.status);

    if (response.status !== 200) {
      throw new Error('Admin delete restaurant request failed');
    }

    // Direct query to verify soft deletion in DB
    const deletedRestaurant = await Restaurant.findOne({ _id: restaurantId, isDeleted: true }).setOptions({ includeDeleted: true });
    console.log('   DB check - isDeleted status:', deletedRestaurant?.isDeleted);
    console.log('   DB check - deletedAt timestamp:', deletedRestaurant?.deletedAt);

    if (!deletedRestaurant || deletedRestaurant.isDeleted !== true || !deletedRestaurant.deletedAt) {
      throw new Error('Restaurant was not soft deleted in DB!');
    }
  } catch (err) {
    console.error('Admin Deletion Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('--- ALL PROFILE AND ADMIN DELETION TESTS COMPLETED SUCCESSFULLY ---');
}

runProfileTests();
