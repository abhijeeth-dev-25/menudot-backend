const mongoose = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/mongoose');
const dotenv = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/dotenv');

// Load env variables
dotenv.config({ path: '/Users/abhijeethkar/Desktop/menudot-backend/.env' });

const config = require('/Users/abhijeethkar/Desktop/menudot-backend/src/config/env');
const User = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/user.model');
const Restaurant = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurant.model');
const RestaurantStaff = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/restaurantStaff.model');
const Expense = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/expense.model');
const DailyFinanceReport = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/dailyFinanceReport.model');
const Order = require('/Users/abhijeethkar/Desktop/menudot-backend/src/models/order.model');

const API_URL = 'http://localhost:5050/api/v1';

async function runFinanceTests() {
  console.log('--- STARTING BACKEND PHASE 3 (FINANCE & OPERATIONS) VERIFICATION ---');

  // 1. CONNECT TO MONGO
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Database connection failed in test script:', err);
    process.exit(1);
  }

  const testOwnerEmail = 'finance_owner_test@menudot.com';
  const testChefEmail = 'finance_chef_test@menudot.com';

  let ownerToken = '';
  let chefToken = '';
  let restaurantId = '';

  // 2. SEED CLEAN RESTAURANT, OWNER, STAFF, AND ORDERS
  try {
    // Clean old test runs
    const oldUsers = await User.find({ email: { $in: [testOwnerEmail, testChefEmail] } });
    const userIds = oldUsers.map(u => u._id);
    if (userIds.length > 0) {
      await Restaurant.deleteMany({ 'owner.userId': { $in: userIds } });
      await RestaurantStaff.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    // Create active owner user
    const owner = new User({
      fullName: 'Finance Test Owner',
      email: testOwnerEmail,
      mobile: '+919999955555',
      passwordHash: 'ownerpassword123',
      status: 'active',
    });
    await owner.save();

    // Create active chef user
    const chef = new User({
      fullName: 'Finance Test Chef',
      email: testChefEmail,
      mobile: '+919999955556',
      passwordHash: 'chefpassword123',
      status: 'active',
    });
    await chef.save();

    // Create approved restaurant
    const restaurant = new Restaurant({
      name: 'Finance Test Cafe',
      slug: 'finance-test-cafe',
      owner: {
        userId: owner._id,
        fullName: 'Finance Test Owner',
        email: testOwnerEmail,
        mobile: '+919999955555',
      },
      location: {
        address: 'Hitech City Road',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        geo: { type: 'Point', coordinates: [78.37, 17.45] },
      },
      schedule: {
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        openTime: '08:00',
        closeTime: '23:00',
      },
      outletType: 'dine_in_and_delivery',
      legal: {
        pan: 'ABCDE5555X',
        gstin: '36ABCDE5555X1Z8',
        fssaiNumber: '99887766552211',
        fssaiExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      bank: {
        ifsc: 'SBIN0005555',
        accountNumber: '999888222333',
      },
      menuProfile: {
        foodType: 'both',
        cuisines: ['Indian'],
        costForTwo: 350,
      },
      onboarding: { stage: 'approved', approvedAt: new Date() },
    });
    await restaurant.save();
    restaurantId = restaurant._id.toString();

    // Map staff joins
    const ownerStaff = new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: owner._id,
      role: 'owner',
      permissions: ['*'],
      status: 'active',
    });
    await ownerStaff.save();

    const chefStaff = new RestaurantStaff({
      restaurantId: restaurant._id,
      userId: chef._id,
      role: 'chef',
      permissions: ['menu_read'],
      status: 'active',
    });
    await chefStaff.save();

    // Clear old expenses, reports, and orders for this restaurant
    await Expense.deleteMany({ restaurantId });
    await DailyFinanceReport.deleteMany({ restaurantId });
    await Order.deleteMany({ restaurantId });

    // Seed Order A (Dine-in, completed, grandTotal: 600)
    const orderA = new Order({
      restaurantId,
      orderNumber: 'FIN-ORD-01',
      orderSource: 'dine_in',
      status: 'completed',
      totals: {
        subtotal: 570,
        tax: 30,
        grandTotal: 600,
      },
      createdAt: new Date('2026-07-20T12:00:00Z'),
    });
    await orderA.save();

    // Seed Order B (Delivery, completed, grandTotal: 400)
    const orderB = new Order({
      restaurantId,
      orderNumber: 'FIN-ORD-02',
      orderSource: 'zomato',
      status: 'completed',
      totals: {
        subtotal: 380,
        tax: 20,
        grandTotal: 400,
      },
      createdAt: new Date('2026-07-20T14:30:00Z'),
    });
    await orderB.save();

    console.log('Seeded clean Finance Test Cafe, staff, Dine-in Order (600), and Zomato Order (400) for 2026-07-20.');
  } catch (err) {
    console.error('Failed to seed finance test details:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 3. LOG IN USERS
  try {
    // Log in Owner
    let loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testOwnerEmail, password: 'ownerpassword123' }),
    });
    let loginData = await loginRes.json();
    ownerToken = loginData.data.tokens.accessToken;

    // Log in Chef
    loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testChefEmail, password: 'chefpassword123' }),
    });
    loginData = await loginRes.json();
    chefToken = loginData.data.tokens.accessToken;

    console.log('Successfully logged in test users.');
  } catch (err) {
    console.error('Login failed:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 4. VERIFY LOG EXPENSES
  try {
    // Expense 1: Raw Materials
    let response = await fetch(`${API_URL}/finance/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        category: 'raw_materials',
        amount: 300,
        description: 'Vegetables & Meat purchase',
        date: '2026-07-20',
      }),
    });
    let data = await response.json();
    console.log('2. Log Raw Materials Expense Status:', response.status);
    console.log('   Expense Amount:', data.data?.amount);

    if (response.status !== 201 || data.data?.amount !== 300) {
      throw new Error('Log raw materials expense failed');
    }

    // Expense 2: Utilities
    response = await fetch(`${API_URL}/finance/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        category: 'utilities',
        amount: 100,
        description: 'Water dispenser service charge',
        date: '2026-07-20',
      }),
    });
    data = await response.json();
    console.log('3. Log Utilities Expense Status:', response.status);
    console.log('   Expense Amount:', data.data?.amount);

    if (response.status !== 201 || data.data?.amount !== 100) {
      throw new Error('Log utilities expense failed');
    }
  } catch (err) {
    console.error('Log Expenses Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 5. VERIFY ROLE PRIVACY (Chef is blocked from reports)
  try {
    const response = await fetch(`${API_URL}/finance/reports/pnl?startDate=2026-07-20&endDate=2026-07-20`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${chefToken}`,
        'x-restaurant-id': restaurantId,
      },
    });
    const data = await response.json();
    console.log('4. Chef Get Reports Status (expected 403):', response.status);
    console.log('   Chef Rejection message:', data.message);

    if (response.status !== 403) {
      throw new Error('Security boundary check failed: Chef was able to read P&L reports!');
    }
  } catch (err) {
    console.error('Role Privacy Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 6. VERIFY MANUAL P&L REPORT GENERATION
  try {
    const response = await fetch(`${API_URL}/finance/reports/pnl/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'x-restaurant-id': restaurantId,
      },
      body: JSON.stringify({
        date: '2026-07-20',
      }),
    });

    const data = await response.json();
    console.log('5. Manual Report Rollup Status:', response.status);
    console.log('   Report profit calculated:', data.data?.netProfitLoss);

    if (response.status !== 200) {
      throw new Error('P&L report generation failed');
    }
  } catch (err) {
    console.error('P&L Rollup Generation Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  // 7. VERIFY P&L REPORT VALUES (Total Revenue: 1000, Total Expenditures: 400, netProfitLoss: 600)
  try {
    const response = await fetch(`${API_URL}/finance/reports/pnl?startDate=2026-07-20&endDate=2026-07-20`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'x-restaurant-id': restaurantId,
      },
    });

    const data = await response.json();
    const report = data.data?.[0];

    console.log('6. Retrieve Reports list Status:', response.status);
    console.log('   P&L Report Date:', report?.date);
    console.log('   Revenue dineIn:', report?.revenue?.dineIn);
    console.log('   Revenue delivery:', report?.revenue?.delivery);
    console.log('   Expenditures inventoryPurchased:', report?.expenditures?.inventoryPurchased);
    console.log('   Expenditures utilitiesAndOthers:', report?.expenditures?.utilitiesAndOthers);
    console.log('   P&L netProfitLoss:', report?.netProfitLoss);

    if (
      report?.revenue?.dineIn !== 600 ||
      report?.revenue?.delivery !== 400 ||
      report?.expenditures?.inventoryPurchased !== 300 ||
      report?.expenditures?.utilitiesAndOthers !== 100 ||
      report?.netProfitLoss !== 600
    ) {
      throw new Error('Rollup values calculation verification failed!');
    }
  } catch (err) {
    console.error('P&L Report Calculation Test Error:', err);
    mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('--- ALL FINANCE & P&L ROLLUP TESTS COMPLETED SUCCESSFULLY ---');
}

runFinanceTests();
