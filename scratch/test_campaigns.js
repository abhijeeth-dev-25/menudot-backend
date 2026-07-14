const mongoose = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/mongoose');
const dotenv = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/dotenv');

// Load env variables
dotenv.config({ path: '/Users/abhijeethkar/Desktop/menudot-backend/.env' });

const config = require('/Users/abhijeethkar/Desktop/menudot-backend/src/config/env');
const User = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/user.model');
const Restaurant = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurant.model');
const RestaurantStaff = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurantStaff.model');
const MenuItem = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/menuItem.model');
const MenuCategory = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/menuCategory.model');
const Campaign = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/campaign.model');

const API_URL = 'http://localhost:5050/api/v1';

async function runCampaignTests() {
  console.log('--- STARTING BACKEND PHASE 5 (ADS & GROWTH CAMPAIGNS) VERIFICATION ---');

  // 1. CONNECT TO MONGO
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection failed in test script:', err);
    process.exit(1);
  }

  const testOwnerEmail = 'campaign_owner_test@menudot.com';
  let ownerToken = '';
  let restaurantId = '';
  let menuItemId = '';
  let campaignId = '';

  // 2. SEED CLEAN RESTAURANT, OWNER, STAFF, AND MENU ITEM
  try {
    // Clean old test runs
    const oldUsers = await User.find({ email: { $in: [testOwnerEmail] } });
    const userIds = oldUsers.map(u => u._id);
    if (userIds.length > 0) {
      await Restaurant.deleteMany({ 'owner.userId': { $in: userIds } });
      await RestaurantStaff.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    // Create owner
    const owner = new User({
      fullName: 'Campaign Test Owner',
      email: testOwnerEmail,
      mobile: '+919999977771',
      passwordHash: 'ownerpassword123',
      status: 'active',
    });
    await owner.save();

    // Create restaurant
    const restaurant = new Restaurant({
      name: 'Campaign Test Cafe',
      slug: 'campaign-test-cafe',
      owner: {
        userId: owner._id,
        fullName: 'Campaign Test Owner',
        email: testOwnerEmail,
        mobile: '+919999977771',
      },
      location: {
        address: 'Jubilee Hills Road 36',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        geo: { type: 'Point', coordinates: [78.4, 17.43] },
      },
      schedule: {
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        openTime: '08:00',
        closeTime: '23:00',
      },
      outletType: 'dine_in_and_delivery',
      legal: {
        pan: 'ABCDE7777Z',
        gstin: '36ABCDE7777Z1Z6',
        fssaiNumber: '99887766554433',
        fssaiExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      bank: {
        ifsc: 'SBIN0007777',
        accountNumber: '999888444555',
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

    // Map staff
    await new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: owner._id,
      role: 'owner',
      permissions: ['*'],
      status: 'active',
    }).save();

    // Clear old data
    await MenuItem.deleteMany({ restaurantId });
    await MenuCategory.deleteMany({ restaurantId });
    await Campaign.deleteMany({ restaurantId });

    // Seed Menu Category
    const category = new MenuCategory({
      restaurantId,
      name: 'Pizzas',
      slug: 'pizzas',
      status: 'active',
    });
    await category.save();

    // Seed MenuItem
    const menuItem = new MenuItem({
      restaurantId,
      categoryId: category._id,
      name: 'Veg Pizza',
      price: 250,
      foodType: 'veg',
      status: 'available',
    });
    await menuItem.save();
    menuItemId = menuItem._id.toString();

    console.log('Seeded clean Campaign Test Cafe, owner, staff, category, and Pizza MenuItem.');
  } catch (err) {
    console.error('Failed to seed campaign test details:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 3. LOG IN OWNER
  try {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testOwnerEmail, password: 'ownerpassword123' }),
    });
    const loginData = await loginRes.json();
    ownerToken = loginData.data.tokens.accessToken;
    console.log('Owner logged in successfully.');
  } catch (err) {
    console.error('Login failed:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 4. VERIFY CAMPAIGN CREATION
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        name: 'Veg Pizza Promo',
        type: 'sponsored_item',
        menuItemId,
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString(),
        budgetLimit: 50, // Rs 50 total limit
        costPerClick: 10, // Rs 10 per click CPC
      }),
    });

    const data = await response.json();
    console.log('1. Create Campaign Status:', response.status);
    console.log('   Campaign Type:', data.data?.type);
    console.log('   Campaign Budget Limit:', data.data?.budgetLimit);
    console.log('   Campaign Status:', data.data?.status);

    if (response.status !== 201 || data.data?.status !== 'active') {
      throw new Error('Create campaign parameters mapping failed');
    }
    campaignId = data.data?._id;
  } catch (err) {
    console.error('Create Campaign Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 5. VERIFY ACTIVE SPONSORED CONTENT SERVED (Increments impressions)
  try {
    // Call active endpoint publicly
    const response = await fetch(`${API_URL}/campaigns/active`, {
      method: 'GET',
      headers: {
        'x-restaurant-id': restaurantId,
      },
    });

    const data = await response.json();
    console.log('2. Serve Active Sponsored Content Status:', response.status);
    console.log('   Total served ads:', data.data?.length);
    console.log('   Served Menu Item Name:', data.data?.[0]?.menuItemId?.name);

    if (response.status !== 200 || data.data?.length !== 1 || data.data?.[0]?.menuItemId?.name !== 'Veg Pizza') {
      throw new Error('Serve active sponsored content details mismatch');
    }

    // Verify impression incremented to 1 in DB
    const campaign = await Campaign.findById(campaignId);
    console.log('   Ad served metrics impressions count:', campaign?.metrics?.impressions);
    if (campaign?.metrics?.impressions !== 1) {
      throw new Error('Served ad impression increment failed');
    }
  } catch (err) {
    console.error('Active Ads Serving Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 6. VERIFY COST TRACKING & CLICKS (2 clicks)
  try {
    // Click 1
    let response = await fetch(`${API_URL}/campaigns/${campaignId}/click`, {
      method: 'POST',
      headers: {
        'x-restaurant-id': restaurantId,
      },
    });
    let data = await response.json();
    console.log('3. Register Click 1 Status:', response.status);
    console.log('   New Clicks count:', data.data?.metrics?.clicks);
    console.log('   New Current Spent:', data.data?.currentSpent);

    if (response.status !== 200 || data.data?.metrics?.clicks !== 1 || data.data?.currentSpent !== 10) {
      throw new Error('Ad click CPC charge failed');
    }

    // Click 2
    response = await fetch(`${API_URL}/campaigns/${campaignId}/click`, {
      method: 'POST',
      headers: {
        'x-restaurant-id': restaurantId,
      },
    });
    data = await response.json();
    console.log('4. Register Click 2 Status:', response.status);
    console.log('   New Clicks count:', data.data?.metrics?.clicks);
    console.log('   New Current Spent:', data.data?.currentSpent);

    if (response.status !== 200 || data.data?.metrics?.clicks !== 2 || data.data?.currentSpent !== 20) {
      throw new Error('Ad click CPC charge failed');
    }
  } catch (err) {
    console.error('Click Tracking Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 7. VERIFY BUDGET DEPLETION AUTO-COMPLETION (Clicks 3, 4, 5)
  try {
    // Loop remaining clicks to exhaust budget (spent will hit 50)
    let finalData;
    for (let c = 3; c <= 5; c++) {
      const response = await fetch(`${API_URL}/campaigns/${campaignId}/click`, {
        method: 'POST',
        headers: {
          'x-restaurant-id': restaurantId,
        },
      });
      finalData = await response.json();
      console.log(`   Processed Click ${c} | Current Spent: ${finalData.data?.currentSpent} | Campaign Status: ${finalData.data?.status}`);
    }

    console.log('5. Budget Exhaustion status update check:');
    console.log('   Final Campaign Status Value:', finalData.data?.status);
    console.log('   Final Clicks count:', finalData.data?.metrics?.clicks);

    if (finalData.data?.status !== 'completed' || finalData.data?.currentSpent !== 50 || finalData.data?.metrics?.clicks !== 5) {
      throw new Error('Ad budget limit exhaustion autocomplete failed');
    }

    // Verify calling active list now returns 0 ads
    const response = await fetch(`${API_URL}/campaigns/active`, {
      method: 'GET',
      headers: {
        'x-restaurant-id': restaurantId,
      },
    });
    const data = await response.json();
    console.log('6. Serve Active Content Status (After Budget Exhaustion):', response.status);
    console.log('   Total served ads count:', data.data?.length);

    if (response.status !== 200 || data.data?.length !== 0) {
      throw new Error('Exhausted budget campaigns are still being served!');
    }
  } catch (err) {
    console.error('Budget Exhaustion Auto-Pausing Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('--- ALL CAMPAIGN & AD GROWTH TESTS COMPLETED SUCCESSFULLY ---');
}

runCampaignTests();
