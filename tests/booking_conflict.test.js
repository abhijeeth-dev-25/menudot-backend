const request = require('supertest');
const app = require('../src/app');
const {
  setupTestDB,
  cleanupTestDB,
  clearDBCollections,
  registerAndApproveRestaurant,
} = require('./helpers');
const Table = require('../src/models/table.model');

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await cleanupTestDB();
});

beforeEach(async () => {
  await clearDBCollections();
});

describe('Dine-In Bookings Conflict and Capacity Constraints', () => {
  let ownerHeaders;
  let restaurant;

  beforeEach(async () => {
    const setup = await registerAndApproveRestaurant();
    ownerHeaders = setup.headers;
    restaurant = setup.restaurant;
  });

  test('should enforce capacity limits and prevent double bookings on same table + slot', async () => {
    // 1. Create table T-3 with capacity 2
    const tableRes = await request(app)
      .post('/api/v1/tables')
      .set(ownerHeaders)
      .send({
        tableNumber: 'T-3',
        capacity: 2,
      })
      .expect(201);

    const tableId = tableRes.body.data._id;
    const tableNumber = tableRes.body.data.tableNumber;

    // 2. Try to book table T-3 for 4 people (capacity overflow)
    const dateStr = '2026-07-20';
    const capacityErrRes = await request(app)
      .post('/api/v1/bookings')
      .send({
        restaurantId: restaurant._id.toString(),
        bookingDate: dateStr,
        timeSlot: '19:00',
        customerName: 'Marcus Aurelius',
        customerMobile: '+919988776655',
        numberOfPeople: 4,
        tableNumber: 'T-3',
      })
      .expect(400);

    expect(capacityErrRes.body.success).toBe(false);
    expect(capacityErrRes.body.message).toContain('insufficient');

    // 3. Book table T-3 for 2 people (successful)
    const bookingRes = await request(app)
      .post('/api/v1/bookings')
      .send({
        restaurantId: restaurant._id.toString(),
        bookingDate: dateStr,
        timeSlot: '19:00',
        customerName: 'Marcus Aurelius',
        customerMobile: '+919988776655',
        numberOfPeople: 2,
        tableNumber: 'T-3',
      })
      .expect(201);

    expect(bookingRes.body.success).toBe(true);
    expect(bookingRes.body.data.status).toBe('confirmed');
    const firstBookingId = bookingRes.body.data._id;

    // 4. Try to double book table T-3 for the same slot (booking conflict)
    const conflictRes = await request(app)
      .post('/api/v1/bookings')
      .send({
        restaurantId: restaurant._id.toString(),
        bookingDate: dateStr,
        timeSlot: '19:00',
        customerName: 'Augustus Caesar',
        customerMobile: '+918877665544',
        numberOfPeople: 2,
        tableNumber: 'T-3',
      })
      .expect(400);

    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.message).toContain('already booked');

    // 5. Create table T-4 with capacity 6
    const table4Res = await request(app)
      .post('/api/v1/tables')
      .set(ownerHeaders)
      .send({
        tableNumber: 'T-4',
        capacity: 6,
      })
      .expect(201);

    // 6. Book table T-4 for 5 people on the same slot
    const booking4Res = await request(app)
      .post('/api/v1/bookings')
      .send({
        restaurantId: restaurant._id.toString(),
        bookingDate: dateStr,
        timeSlot: '19:00',
        customerName: 'Tiberius Caesar',
        customerMobile: '+917766554433',
        numberOfPeople: 5,
        tableNumber: 'T-4',
      })
      .expect(201);

    expect(booking4Res.body.success).toBe(true);
    const secondBookingId = booking4Res.body.data._id;

    // 7. Try to reassign T-3 booking to T-4 (which is already booked for that slot)
    const reassignConflictRes = await request(app)
      .patch(`/api/v1/bookings/${firstBookingId}`)
      .set(ownerHeaders)
      .send({
        tableNumber: 'T-4',
      })
      .expect(400);

    expect(reassignConflictRes.body.success).toBe(false);
    expect(reassignConflictRes.body.message).toContain('already booked');

    // 8. Try to reassign T-4 booking (5 people) to T-3 (which only has capacity 2)
    const reassignCapacityRes = await request(app)
      .patch(`/api/v1/bookings/${secondBookingId}`)
      .set(ownerHeaders)
      .send({
        tableNumber: 'T-3',
      })
      .expect(400);

    expect(reassignCapacityRes.body.success).toBe(false);
    expect(reassignCapacityRes.body.message).toContain('smaller than booking party size');
  });
});
