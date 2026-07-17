/**
 * Seed Script: Create Platform Admin
 * ------------------------------------
 * Run this script once to seed a platform_admin user into the live database.
 * Usage: node scratch/seed_admin.js
 * 
 * Requires the server's .env file to be present for MONGODB_URI.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/menudot';

const ADMIN_EMAIL = 'admin@menudot.com';
const ADMIN_PASSWORD = 'adminpassword123';

async function seedAdmin() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', MONGODB_URI);

  const db = mongoose.connection.db;

  // Check if admin already exists
  const existing = await db.collection('users').findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log('ℹ️  Platform admin already exists:', existing._id.toString());
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const result = await db.collection('users').insertOne({
    fullName: 'Platform Admin',
    email: ADMIN_EMAIL,
    mobile: '+919999999999',
    passwordHash,
    globalRole: 'platform_admin',
    status: 'active',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  });

  console.log('✅ Platform admin created successfully!');
  console.log('   ID:', result.insertedId.toString());
  console.log('   Email:', ADMIN_EMAIL);
  console.log('   Password:', ADMIN_PASSWORD);

  await mongoose.disconnect();
}

seedAdmin().catch(err => {
  console.error('❌ Failed to seed admin:', err);
  process.exit(1);
});
