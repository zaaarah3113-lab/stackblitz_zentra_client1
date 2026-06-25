console.log('SCRIPT STARTED - LINE 1');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const Product = require('./productModel');
const User = require('./userModel');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Base Testing Route
app.get('/api/test', (req, res) => {
  res.json({
    message:
      'Welcome to Maas Trends Backend! The cloud server is running beautifully!',
  });
});


// =========================
// AUTH ROUTES
// =========================

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid credentials',
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(400).json({
        error: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// =========================
// FORGOT PASSWORD (phone + OTP)
// =========================
//
// NOTE: This generates a real, time-limited OTP and stores it (hashed-free,
// since it's short-lived) on the user document. Right now it does NOT send
// a real SMS — it logs the code to the server console (visible in your
// Render logs) so you can test the full flow today. To go live with real
// SMS, swap the console.log line in /forgot-password/request-otp for a call
// to a provider like Twilio or MSG91 using the same `otp` and `phone`.

// STEP 1: request an OTP for a phone number
app.post('/api/auth/forgot-password/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        error: 'Please provide a valid 10-digit phone number',
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        error: 'No account found with that mobile number',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = expires;
    await user.save();

    // TODO: replace this with a real SMS provider call (Twilio, MSG91, etc.)
    console.log(`[OTP] Password reset code for ${phone}: ${otp} (expires ${expires.toISOString()})`);

    res.json({
      message: 'A verification code has been sent to your registered mobile number.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STEP 2: verify the OTP
app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    const user = await User.findOne({ phone });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ error: 'No reset request found for this number' });
    }

    if (user.resetOtpExpires < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    res.json({ message: 'Code verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STEP 3: set the new password (re-checks the OTP for safety)
app.post('/api/auth/forgot-password/reset', async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'Phone, code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ phone });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ error: 'No reset request found for this number' });
    }

    if (user.resetOtpExpires < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// FORGOT PASSWORD (phone + OTP)
// =========================
//
// Flow:
//  1. POST /api/auth/forgot-password/request-otp   { phone }
//     -> generates a 6-digit OTP, stores a HASH of it (never the raw code)
//        with a 10-minute expiry, and "sends" it (currently logs it to the
//        server console — wire up Twilio/MSG91/etc. here later).
//  2. POST /api/auth/forgot-password/verify-otp     { phone, otp }
//     -> checks the OTP against the stored hash and expiry.
//  3. POST /api/auth/forgot-password/reset          { phone, otp, newPassword }
//     -> re-verifies the OTP one last time, then sets the new (bcrypt-hashed)
//        password and clears the OTP fields so it can't be reused.

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  // 6-digit numeric code, e.g. "048213"
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// STEP 1 — request a code
app.post('/api/auth/forgot-password/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Please provide a valid 10-digit mobile number.' });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ error: 'No account found with that mobile number.' });
    }

    const otp = generateOtp();
    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    // TODO: replace this console.log with a real SMS provider call
    // (e.g. Twilio, MSG91, Fast2SMS) once you have an account set up.
    console.log(`[OTP] Password reset code for ${phone}: ${otp} (expires in 10 min)`);

    res.json({ message: 'OTP sent to your registered mobile number.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STEP 2 — verify the code
app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required.' });
    }

    const user = await User.findOne({ phone });

    if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
      return res.status(400).json({ error: 'No reset request found. Please request a new code.' });
    }

    if (user.resetOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }

    if (hashOtp(otp) !== user.resetOtpHash) {
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    res.json({ message: 'Code verified.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STEP 3 — set the new password
app.post('/api/auth/forgot-password/reset', async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'Phone, OTP, and new password are all required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ phone });

    if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
      return res.status(400).json({ error: 'No reset request found. Please request a new code.' });
    }

    if (user.resetOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
    }

    if (hashOtp(otp) !== user.resetOtpHash) {
      return res.status(400).json({ error: 'Incorrect code.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtpHash = null;
    user.resetOtpExpires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// AUTH MIDDLEWARE
// =========================

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
    });
  }

  next();
};

// =========================
// PRODUCT ROUTES
// =========================

// GET all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET one product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
      });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// CREATE a new product
app.post(
  '/api/products',
  authenticateToken,
  adminOnly,
  async (req, res) => {
  try {
    const product = new Product(req.body);

    await product.save();

    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
});

// UPDATE an existing product
app.put(
  '/api/products/:id',
  authenticateToken,
  adminOnly,
  async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
      });
    }

    res.json(product);
  } catch (err) {
    res.status(400).json({
      error: err.message,
    });
  }
});

// DELETE a product
app.delete(
  '/api/products/:id',
  authenticateToken,
  adminOnly,
  async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
      });
    }

    res.json({
      message: 'Product deleted successfully',
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

console.log('ROUTES DEFINED - ABOUT TO START SERVER FUNCTION');

async function startServer() {
  console.log('INSIDE STARTSERVER - BEFORE MONGOOSE CONNECT');

  console.log(
    'MONGO_URI value is:',
    process.env.MONGO_URI
      ? 'DEFINED (hidden for safety)'
      : 'UNDEFINED'
  );

  try {
    console.log('Attempting MongoDB connection...');

await mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 8000,
});

console.log('MongoDB connection completed');

    console.log(
      'MongoDB Atlas connected successfully for Maas Trends!'
    );

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

console.log('ABOUT TO CALL STARTSERVER');
startServer();
console.log('STARTSERVER CALLED - SCRIPT REACHED END');