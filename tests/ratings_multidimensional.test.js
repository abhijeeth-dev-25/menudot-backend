const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const MenuItem = require('../src/models/menuItem.model');
const MenuCategory = require('../src/models/menuCategory.model');
const Restaurant = require('../src/models/restaurant.model');
const Table = require('../src/models/table.model');
const Feedback = require('../src/models/feedback.model');
const { connectDB, disconnectDB } = require('../src/database/db');

describe('Multi-Dimensional Rating System Tests', () => {
  let restaurantId;
  let categoryId;
  let item1Id;
  let item2Id;
  let tableId;
  let qrToken;

  beforeAll(async () => {
    await connectDB();

    // Create test restaurant
    const restaurant = await Restaurant.create({
      name: 'Multi-Rating Bistro',
      slug: `rating-bistro-${Date.now()}`,
      owner: {
        userId: new mongoose.Types.ObjectId(),
        fullName: 'Rating Owner',
        email: `rating_${Date.now()}@example.com`,
        mobile: '+919876543210',
      },
      outletType: 'dine_in_and_delivery',
      status: 'active',
      location: {
        address: '123 Rating Street',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        geo: {
          type: 'Point',
          coordinates: [78.43, 17.45],
        },
      },
      menuProfile: {
        foodType: 'both',
        cuisines: ['Continental'],
        costForTwo: 600,
      },
      legal: {
        pan: 'ABCDE1234F',
        gstin: '36ABCDE1234F1Z5',
        fssaiNumber: '12345678901234',
        fssaiExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      bank: { accountNumber: '1234567890', ifsc: 'SBIN0001234' },
      schedule: { workingDays: ['MON'], openTime: '09:00', closeTime: '22:00' },
    });
    restaurantId = restaurant._id.toString();

    // Create Category
    const category = await MenuCategory.create({
      restaurantId,
      name: 'Gourmet Pizzas',
      slug: 'gourmet-pizzas',
      isActive: true,
    });
    categoryId = category._id.toString();

    // Create 2 Menu Items
    const item1 = await MenuItem.create({
      restaurantId,
      categoryId,
      name: 'Truffle Mushroom Pizza',
      price: 499,
      foodType: 'veg',
      rating: 5.0,
      ratingCount: 0,
      totalRatingPoints: 0,
      status: 'available',
    });
    item1Id = item1._id.toString();

    const item2 = await MenuItem.create({
      restaurantId,
      categoryId,
      name: 'Overloaded Cheese Pizza',
      price: 399,
      foodType: 'veg',
      rating: 5.0,
      ratingCount: 0,
      totalRatingPoints: 0,
      status: 'available',
    });
    item2Id = item2._id.toString();

    // Create Table for QR scan catalog verification
    qrToken = `qr_multirating_${Date.now()}`;
    const table = await Table.create({
      restaurantId,
      tableNumber: 'MR-01',
      capacity: 4,
      status: 'vacant',
      qrCode: { code: qrToken, isActive: true },
    });
    tableId = table._id.toString();
  });

  afterAll(async () => {
    await MenuItem.deleteMany({ restaurantId });
    await MenuCategory.deleteMany({ restaurantId });
    await Table.deleteMany({ restaurantId });
    await Feedback.deleteMany({ restaurantId });
    await Restaurant.deleteMany({ _id: restaurantId });
    await disconnectDB();
  });

  test('1. Should submit multi-dimensional customer feedback (Items + Service + Restaurant + Platform)', async () => {
    const payload = {
      restaurantId,
      customerName: 'Alice Springs',
      customerMobile: '+919988776655',
      rating: 5, // overall rating
      serviceRating: 5,
      restaurantRating: 5,
      platformRating: 4,
      itemRatings: [
        {
          menuItemId: item1Id,
          itemName: 'Truffle Mushroom Pizza',
          rating: 5,
          tags: ['Must Try', 'Chef Special'],
          comment: 'Heavenly aroma and crust!',
        },
        {
          menuItemId: item2Id,
          itemName: 'Overloaded Cheese Pizza',
          rating: 3,
          tags: ['Too Oily'],
          comment: 'Good cheese but a bit heavy',
        },
      ],
      comment: 'Overall fantastic experience, rapid service!',
    };

    const res = await request(app).post('/api/v1/feedback').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customerName).toBe('Alice Springs');
    expect(res.body.data.itemRatings.length).toBe(2);
  });

  test('2. Should verify atomic update of MenuItem rating metrics & popular tags', async () => {
    const item1 = await MenuItem.findById(item1Id);
    expect(item1.rating).toBe(5);
    expect(item1.ratingCount).toBe(1);
    expect(item1.totalRatingPoints).toBe(5);
    expect(item1.ratingBreakdown[5]).toBe(1);
    expect(item1.popularTags.some((t) => t.tag === 'Must Try')).toBe(true);

    const item2 = await MenuItem.findById(item2Id);
    expect(item2.rating).toBe(3);
    expect(item2.ratingCount).toBe(1);
    expect(item2.totalRatingPoints).toBe(3);
    expect(item2.ratingBreakdown[3]).toBe(1);
    expect(item2.popularTags.some((t) => t.tag === 'Too Oily')).toBe(true);
  });

  test('3. Should verify restaurant aggregated ratings summary update', async () => {
    const restaurant = await Restaurant.findById(restaurantId);
    expect(restaurant.ratingsSummary.overallRating).toBe(5);
    expect(restaurant.ratingsSummary.serviceRating).toBe(5);
    expect(restaurant.ratingsSummary.totalReviews).toBe(1);
  });

  test('4. Should submit a second rating and verify weighted average recalculation', async () => {
    const payload2 = {
      restaurantId,
      customerName: 'Bob Builder',
      rating: 4,
      serviceRating: 3,
      itemRatings: [
        {
          menuItemId: item1Id,
          rating: 4,
          tags: ['Must Try'],
        },
      ],
    };

    const res = await request(app).post('/api/v1/feedback').send(payload2);
    expect(res.status).toBe(201);

    const item1 = await MenuItem.findById(item1Id);
    // (5 + 4) / 2 = 4.5
    expect(item1.rating).toBe(4.5);
    expect(item1.ratingCount).toBe(2);
    expect(item1.totalRatingPoints).toBe(9);
    expect(item1.popularTags.find((t) => t.tag === 'Must Try').count).toBe(2);
  });

  test('5. Customer catalog scan should include item rating metrics & isTopRated badge', async () => {
    const res = await request(app).post('/api/v1/tables/scan').send({
      code: qrToken,
      customerName: 'Test Diner',
      numberOfPeople: 2,
      deviceId: `device_${Date.now()}`,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.menu).toBeDefined();

    const categoryObj = res.body.data.menu[0];
    const items = categoryObj.items;

    const trufflePizza = items.find((i) => i._id.toString() === item1Id);
    expect(trufflePizza).toBeDefined();
    expect(trufflePizza.rating).toBe(4.5);
    expect(trufflePizza.isTopRated).toBe(true);
  });
});
