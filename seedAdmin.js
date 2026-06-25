// seedAdmin.js
// One-time script to create your first real admin account in MongoDB.
//
// HOW TO USE:
// 1. Edit the ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD values below.
// 2. Run:  node seedAdmin.js
// 3. It will print a success message once the admin user exists.
// 4. You can delete this file afterwards, or just leave it (it's safe to
//    run again — it will refuse to create a duplicate).

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./userModel');

// ─── EDIT THESE FOUR VALUES ───
const ADMIN_NAME = 'Admin';
const ADMIN_EMAIL = 'admin@maastrends.com';
const ADMIN_PASSWORD = '54321';
const ADMIN_PHONE = '9500820522'; // 10-digit number, used for "Forgot Password"
// ────────────────────────────────

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('Connected.');

    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      if (existing.role === 'admin') {
        console.log(`An admin with email "${ADMIN_EMAIL}" already exists. Nothing to do.`);
      } else {
        existing.role = 'admin';
        await existing.save();
        console.log(`Existing user "${ADMIN_EMAIL}" was promoted to admin.`);
      }
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      phone: ADMIN_PHONE,
    });

    console.log('✅ Admin user created successfully:');
    console.log({
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });
    console.log('\nYou can now log in to the admin portal with:');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('\n⚠️  Change this password after your first login, and never commit it to GitHub.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err.message);
    process.exit(1);
  }
}

seedAdmin();