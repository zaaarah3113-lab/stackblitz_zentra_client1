console.log('SCRIPT STARTED - LINE 1');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const Product = require('./productModel');
const User = require('./userModel');
const Order = require('./orderModel');
const Cart = require('./cartModel');
const DeliveryCharge = require('./deliveryChargeModel');
const { getSetting, setSetting } = require('./settingsModel');
const { getNextSequence } = require('./counterModel');

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS configuration ──
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
];
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...DEV_ORIGINS,
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
}));
// Razorpay webhook signature verification requires the raw request body.
app.use('/api/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
}));

function getRazorpayAuthHeader() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  const token = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');
  return `Basic ${token}`;
}

async function createRazorpayOrder(payload) {
  const authHeader = getRazorpayAuthHeader();
  if (!authHeader) {
    throw new Error('Razorpay is not configured on the server.');
  }

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || data.error || 'Failed to create Razorpay order.');
  }
  return data;
}
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
}));

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

// Like authenticateToken, but never blocks the request if no/invalid token
// is present — it just leaves req.user as null. Used on guest-checkout
// routes so a logged-in account still gets linked to its order, without
// forcing every customer to have one.
const optionalAuth = (req, res, next) => {
  req.user = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Invalid/expired token on a guest route — just proceed as a guest
    // rather than failing the whole request.
    req.user = null;
  }
  next();
};

// Ensures every cart-related request has a guest session ID. Reads it from
// an HTTP-only cookie if present; otherwise generates a new cryptographically
// random ID and sets the cookie for next time. The cookie is HTTP-only
// (unreadable by JS, protecting it from XSS) and persists for a year so a
// returning customer's cart survives a closed browser, not just a refresh.
//
// This is the ONLY identity a guest shopper has — there is no login — so
// this single cookie is what makes "the backend owns the cart" possible
// instead of trusting localStorage.
//
// Cookie attributes depend on environment:
//   Production (NODE_ENV=production): secure + sameSite "none", required
//     for a cross-site cookie to be sent between your frontend's domain and
//     this backend's Render domain over HTTPS.
//   Development: secure must be false and sameSite "lax", because
//     `http://localhost` is not HTTPS — a `secure` cookie would silently
//     never be set on plain HTTP, breaking the cart with no visible error.
// Note: pages opened directly via file:// cannot reliably receive cookies
// at all regardless of these settings — that's a browser-level restriction
// on the file:// protocol, not something fixable from the server side.
// Run the frontend through a local dev server (e.g. `npx http-server`,
// VS Code "Live Server") to test the cart properly before deployment.
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = 'mt_guest_id';
const ensureGuestSession = (req, res, next) => {
  let guestId = req.cookies[COOKIE_NAME];

  if (!guestId) {
    guestId = crypto.randomBytes(24).toString('hex');
    res.cookie(COOKIE_NAME, guestId, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    });
  }

  req.guestId = guestId;
  next();
};

// =========================
// DELIVERY CHARGE HELPERS
// =========================

async function resolveDeliveryCharge(pincode) {
  const normalized = String(pincode || '').trim();
  if (!normalized) {
    throw new Error('Pincode is required.');
  }

  const entry = await DeliveryCharge.findOne({ pincode: normalized });
  if (entry) {
    return {
      pincode: normalized,
      areaName: entry.areaName || '',
      deliveryCharge: entry.deliveryCharge,
      isDefault: false,
    };
  }

  const defaultCharge = await getSetting('default_delivery_charge', 0);
  return {
    pincode: normalized,
    areaName: '',
    deliveryCharge: Number(defaultCharge) || 0,
    isDefault: true,
  };
}

async function buildOrderItemsFromCart(cart, session) {
  const orderItems = [];
  let subtotal = 0;

  for (const cartItem of cart.items) {
    const product = await Product.findById(cartItem.product).session(session);
    if (!product) {
      throw new Error('One of the items in your cart is no longer available.');
    }
    if (product.stock < cartItem.quantity) {
      throw new Error(`Not enough stock for "${product.name}". Only ${product.stock} left.`);
    }

    const lineSubtotal = product.price * cartItem.quantity;
    subtotal += lineSubtotal;

    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: cartItem.quantity,
      subtotal: lineSubtotal,
    });
  }

  return { orderItems, subtotal };
}

async function decrementStockForOrderItems(orderItems, session) {
  for (const item of orderItems) {
    const product = await Product.findById(item.product).session(session);
    if (!product) {
      throw new Error('One of the items in your order is no longer available.');
    }
    if (product.stock < item.quantity) {
      throw new Error(`Not enough stock for "${product.name}". Only ${product.stock} left.`);
    }
    product.stock -= item.quantity;
    await product.save({ session });
  }
}

function calculateGrandTotal(subtotal, shippingFee, discount = 0, tax = 0) {
  return subtotal - discount + shippingFee + tax;
}

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

// ----- FIXED: UPDATE product with explicit field mapping and logging -----
app.put(
  '/api/products/:id',
  authenticateToken,
  adminOnly,
  async (req, res) => {
    try {
      console.log('📦 Updating product with body:', req.body);

      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Explicitly map every field from request body (or keep existing)
      product.name = req.body.name !== undefined ? req.body.name : product.name;
      product.category = req.body.category !== undefined ? req.body.category : product.category;
      product.price = req.body.price !== undefined ? req.body.price : product.price;
      product.mrp = req.body.mrp !== undefined ? req.body.mrp : product.mrp;
      product.stock = req.body.stock !== undefined ? req.body.stock : product.stock;
      product.stockStatus = req.body.stockStatus !== undefined ? req.body.stockStatus : product.stockStatus;
      product.description = req.body.description !== undefined ? req.body.description : product.description;
      product.image = req.body.image !== undefined ? req.body.image : product.image;
      product.fabric = req.body.fabric !== undefined ? req.body.fabric : product.fabric;
      product.care = req.body.care !== undefined ? req.body.care : product.care;

      await product.save();

      console.log('✅ Updated product:', product);
      res.json(product);
    } catch (err) {
      console.error('Update error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

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

// =========================
// DELIVERY CHARGE ROUTES
// =========================

// Public lookup — used by customer checkout when pincode is entered
app.get('/api/delivery-charge', async (req, res) => {
  try {
    const { pincode } = req.query;
    const result = await resolveDeliveryCharge(pincode);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: list all delivery charge entries (optional pincode search)
app.get('/api/admin/delivery-charges', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { pincode: { $regex: String(search).trim(), $options: 'i' } }
      : {};
    const entries = await DeliveryCharge.find(filter).sort({ pincode: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get configurable default delivery charge
app.get('/api/admin/settings/default-delivery-charge', authenticateToken, adminOnly, async (req, res) => {
  try {
    const value = await getSetting('default_delivery_charge', 0);
    res.json({ defaultDeliveryCharge: Number(value) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update default delivery charge
app.put('/api/admin/settings/default-delivery-charge', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { defaultDeliveryCharge } = req.body;
    const charge = Number(defaultDeliveryCharge);
    if (Number.isNaN(charge) || charge < 0) {
      return res.status(400).json({ error: 'defaultDeliveryCharge must be a number of 0 or more.' });
    }
    await setSetting('default_delivery_charge', charge);
    res.json({ defaultDeliveryCharge: charge });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: create delivery charge entry
app.post('/api/admin/delivery-charges', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { pincode, areaName, deliveryCharge } = req.body;
    if (!pincode || deliveryCharge === undefined || deliveryCharge === null) {
      return res.status(400).json({ error: 'pincode and deliveryCharge are required.' });
    }
    const entry = await DeliveryCharge.create({
      pincode: String(pincode).trim(),
      areaName: areaName || '',
      deliveryCharge: Number(deliveryCharge),
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: update delivery charge entry
app.put('/api/admin/delivery-charges/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { pincode, areaName, deliveryCharge } = req.body;
    const update = {};
    if (pincode !== undefined) update.pincode = String(pincode).trim();
    if (areaName !== undefined) update.areaName = areaName;
    if (deliveryCharge !== undefined) update.deliveryCharge = Number(deliveryCharge);

    const entry = await DeliveryCharge.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!entry) {
      return res.status(404).json({ error: 'Delivery charge entry not found.' });
    }

    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: delete delivery charge entry
app.delete('/api/admin/delivery-charges/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const entry = await DeliveryCharge.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Delivery charge entry not found.' });
    }
    res.json({ message: 'Delivery charge entry deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// CART ROUTES
// =========================
//
// The cart is the backend's source of truth. The frontend may cache a copy
// in localStorage purely for instant UI rendering, but every price, stock
// check, and total shown to the customer should come from these endpoints,
// not be computed client-side from cached data — otherwise nothing stops a
// shopper from editing localStorage to change a price.
//
// Carts are keyed on the guest session cookie (see ensureGuestSession
// above). If customer accounts are added later, a login step can look up
// the guest's cart by guestId and either attach `user` to it directly or
// merge its items into an existing user cart — no schema change required,
// since `user` already exists on the Cart model for exactly this purpose.

// Helper: build a cart response with live product data resolved in
// (price, name, image, stock), rather than trusting anything stored on the
// cart document itself except product ID + quantity.
async function buildCartResponse(cart) {
  const items = [];
  let subtotal = 0;

  for (const entry of cart.items) {
    const product = await Product.findById(entry.product);
    if (!product) {
      // Product was deleted since being added to cart — skip it silently;
      // the frontend will simply no longer see it in the cart.
      continue;
    }
    const lineSubtotal = product.price * entry.quantity;
    subtotal += lineSubtotal;
    items.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      stock: product.stock,
      quantity: entry.quantity,
      subtotal: lineSubtotal,
    });
  }

  return {
    items,
    subtotal,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// GET current cart (creates an empty one if none exists yet for this guest)
app.get('/api/cart', ensureGuestSession, async (req, res) => {
  try {
    let cart = await Cart.findOne({ guestId: req.guestId });
    if (!cart) {
      cart = await Cart.create({ guestId: req.guestId, items: [] });
    }
    res.json(await buildCartResponse(cart));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD an item to the cart (or increase quantity if it's already in there)
app.post('/api/cart/items', ensureGuestSession, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number(quantity) || 1;

    if (!productId || qty < 1) {
      return res.status(400).json({ error: 'productId and a quantity of at least 1 are required.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    let cart = await Cart.findOne({ guestId: req.guestId });
    if (!cart) {
      cart = await Cart.create({ guestId: req.guestId, items: [] });
    }

    const existing = cart.items.find(i => String(i.product) === String(productId));
    const newQty = (existing ? existing.quantity : 0) + qty;

    if (newQty > product.stock) {
      return res.status(400).json({
        error: `Only ${product.stock} of "${product.name}" left in stock.`,
      });
    }

    if (existing) {
      existing.quantity = newQty;
    } else {
      cart.items.push({ product: productId, quantity: qty });
    }

    await cart.save();
    res.json(await buildCartResponse(cart));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE an item's quantity in the cart (set to 0 to remove it)
app.put('/api/cart/items/:productId', ensureGuestSession, async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);

    if (Number.isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'quantity must be a number of 0 or more.' });
    }

    const cart = await Cart.findOne({ guestId: req.guestId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found.' });
    }

    if (qty === 0) {
      cart.items = cart.items.filter(i => String(i.product) !== req.params.productId);
    } else {
      const product = await Product.findById(req.params.productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }
      if (qty > product.stock) {
        return res.status(400).json({
          error: `Only ${product.stock} of "${product.name}" left in stock.`,
        });
      }
      const existing = cart.items.find(i => String(i.product) === req.params.productId);
      if (existing) {
        existing.quantity = qty;
      } else {
        cart.items.push({ product: req.params.productId, quantity: qty });
      }
    }

    await cart.save();
    res.json(await buildCartResponse(cart));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// REMOVE a single item from the cart
app.delete('/api/cart/items/:productId', ensureGuestSession, async (req, res) => {
  try {
    const cart = await Cart.findOne({ guestId: req.guestId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found.' });
    }
    cart.items = cart.items.filter(i => String(i.product) !== req.params.productId);
    await cart.save();
    res.json(await buildCartResponse(cart));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CLEAR the entire cart (used after a successful checkout)
app.delete('/api/cart', ensureGuestSession, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { guestId: req.guestId },
      { items: [] },
      { upsert: true }
    );
    res.json({ items: [], subtotal: 0, itemCount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ORDER ROUTES
// =========================
//
// Checkout always goes through the cart — it is read fresh from the
// database, never trusted from the request body. This is what prevents a
// shopper from posting a fake price/quantity directly to /api/orders.

// CREATE an order from the current cart (public — guest checkout, COD)
app.post('/api/orders/checkout', ensureGuestSession, optionalAuth, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { shipping, paymentMethod, notes } = req.body;

    if (!shipping || !shipping.fullName || !shipping.phone || !shipping.addressLine1 ||
        !shipping.city || !shipping.state || !shipping.pincode) {
      return res.status(400).json({ error: 'Missing required shipping details.' });
    }

    if (paymentMethod === 'razorpay') {
      return res.status(400).json({
        error: 'Online payments must use /api/orders/razorpay/create.',
      });
    }

    const cart = await Cart.findOne({ guestId: req.guestId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    const delivery = await resolveDeliveryCharge(shipping.pincode);
    let orderItems = [];
    let subtotal = 0;

    await session.withTransaction(async () => {
      const built = await buildOrderItemsFromCart(cart, session);
      orderItems = built.orderItems;
      subtotal = built.subtotal;
      await decrementStockForOrderItems(orderItems, session);
    });

    const shippingFee = delivery.deliveryCharge;
    const discount = 0;
    const tax = 0;
    const grandTotal = calculateGrandTotal(subtotal, shippingFee, discount, tax);

    const customerKey = shipping.email
      ? shipping.email.trim().toLowerCase()
      : shipping.phone.trim();

    const sequence = await getNextSequence('orderNumber');
    const orderNumber = `MT${sequence}`;

    const order = await Order.create({
      orderNumber,
      user: req.user ? req.user.id : null,
      guestId: req.guestId,
      customerKey,
      items: orderItems,
      shipping,
      subtotal,
      shippingFee,
      discount,
      tax,
      grandTotal,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'order_placed',
      notes: notes || '',
    });

    cart.items = [];
    await cart.save();

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// CREATE a Razorpay order from the current cart (server-calculated total)
app.post('/api/orders/razorpay/create', ensureGuestSession, optionalAuth, async (req, res) => {
  try {
    if (!getRazorpayAuthHeader()) {
      return res.status(503).json({ error: 'Razorpay is not configured on the server.' });
    }

    const { shipping, notes } = req.body;

    if (!shipping || !shipping.fullName || !shipping.phone || !shipping.addressLine1 ||
        !shipping.city || !shipping.state || !shipping.pincode) {
      return res.status(400).json({ error: 'Missing required shipping details.' });
    }

    const cart = await Cart.findOne({ guestId: req.guestId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    const delivery = await resolveDeliveryCharge(shipping.pincode);
    const { orderItems, subtotal } = await buildOrderItemsFromCart(cart, null);

    const shippingFee = delivery.deliveryCharge;
    const discount = 0;
    const tax = 0;
    const grandTotal = calculateGrandTotal(subtotal, shippingFee, discount, tax);

    const customerKey = shipping.email
      ? shipping.email.trim().toLowerCase()
      : shipping.phone.trim();

    const sequence = await getNextSequence('orderNumber');
    const orderNumber = `MT${sequence}`;

    const order = await Order.create({
      orderNumber,
      user: req.user ? req.user.id : null,
      guestId: req.guestId,
      customerKey,
      items: orderItems,
      shipping,
      subtotal,
      shippingFee,
      discount,
      tax,
      grandTotal,
      paymentMethod: 'razorpay',
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
      notes: notes || '',
    });

    const razorpayOrder = await createRazorpayOrder({
      amount: Math.round(grandTotal * 100),
      currency: 'INR',
      receipt: orderNumber,
      notes: {
        orderId: String(order._id),
        orderNumber,
      },
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(201).json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      amount: grandTotal,
      amountPaise: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      subtotal,
      shippingFee,
      grandTotal,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Poll payment status after Razorpay checkout (webhook is source of truth)
app.get('/api/orders/:id/payment-status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select(
      'orderNumber paymentStatus orderStatus grandTotal subtotal shippingFee items shipping razorpayPaymentId paymentMethod'
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      grandTotal: order.grandTotal,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      items: order.items,
      shipping: order.shipping,
      paymentMethod: order.paymentMethod,
      paid: order.paymentStatus === 'paid',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay webhook — verifies signature and marks order as paid
app.post('/api/razorpay/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: 'Webhook secret is not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventType = event.event;

    if (eventType === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      const order = await Order.findOne({ razorpayOrderId });
      if (!order) {
        return res.status(404).json({ error: 'Order not found for Razorpay order.' });
      }

      if (order.paymentStatus === 'paid') {
        return res.json({ status: 'already_processed' });
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await decrementStockForOrderItems(order.items, session);

          order.paymentStatus = 'paid';
          order.orderStatus = 'order_placed';
          order.razorpayPaymentId = payment.id;
          order.razorpaySignature = signature;
          await order.save({ session });

          if (order.guestId) {
            await Cart.findOneAndUpdate(
              { guestId: order.guestId },
              { items: [] },
              { session }
            );
          }
        });
      } finally {
        session.endSession();
      }

      return res.json({ status: 'paid' });
    }

    if (eventType === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order && order.paymentStatus !== 'paid') {
        order.paymentStatus = 'failed';
        order.orderStatus = 'cancelled';
        await order.save();
      }
      return res.json({ status: 'failed_recorded' });
    }

    res.json({ status: 'ignored' });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST all orders (admin only)
app.get('/api/orders', authenticateToken, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order by ID (admin only)
app.get('/api/orders/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE order status (admin only) — e.g. mark as shipped/delivered/cancelled
app.put('/api/orders/:id/status', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const update = {};

    if (orderStatus) {
      const validStatuses = ['awaiting_payment', 'order_placed', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(orderStatus)) {
        return res.status(400).json({ error: `orderStatus must be one of: ${validStatuses.join(', ')}` });
      }
      update.orderStatus = orderStatus;
    }
    if (paymentStatus) {
      const validPayments = ['pending', 'paid', 'failed', 'refunded'];
      if (!validPayments.includes(paymentStatus)) {
        return res.status(400).json({ error: `paymentStatus must be one of: ${validPayments.join(', ')}` });
      }
      update.paymentStatus = paymentStatus;
    }

    const order = await Order.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================
// DASHBOARD / ANALYTICS ROUTES (admin only)
// =========================
// All figures below are computed live from real Order/Product documents.
// If there is no data yet, totals come back as 0 / empty arrays — the
// frontend is responsible for showing a truthful "No orders yet" state
// rather than inventing placeholder numbers.

app.get('/api/admin/dashboard-stats', authenticateToken, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find();
    const productCount = await Product.countDocuments();

    const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalOrders = orders.length;

    // Monthly revenue + order counts for the last 6 calendar months
    // (including the current month), oldest first.
    const monthly = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
      const monthOrders = orders.filter(o => {
        const od = new Date(o.createdAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
      });
      monthly.push({
        m: monthLabel,
        v: monthOrders.reduce((sum, o) => sum + o.grandTotal, 0),
        orders: monthOrders.length,
      });
    }

    // Category breakdown by revenue share, computed from order line items.
    const categoryRevenue = {}; // categoryName -> revenue
    const productSales = {};    // productId -> { name, category, sold, rev }

    for (const order of orders) {
      for (const item of order.items) {
        // We only stored name/price snapshots on the order item, not
        // category — so look the category up from the live product when
        // available (falls back to "Uncategorised" if the product was
        // since deleted).
        const prod = await Product.findById(item.product).lean();
        const category = prod ? prod.category : 'Uncategorised';

        categoryRevenue[category] = (categoryRevenue[category] || 0) + item.subtotal;

        const key = String(item.product);
        if (!productSales[key]) {
          productSales[key] = { n: item.name, cat: category, sold: 0, rev: 0 };
        }
        productSales[key].sold += item.quantity;
        productSales[key].rev += item.subtotal;
      }
    }

    const totalCategoryRevenue = Object.values(categoryRevenue).reduce((a, b) => a + b, 0);
    const palette = ['#0d5c45', '#2db892', '#c8a96e', '#3b82f6', '#e24b4a', '#8b5cf6', '#f59e0b'];
    const categories = Object.entries(categoryRevenue)
      .sort((a, b) => b[1] - a[1])
      .map(([c, rev], idx) => ({
        c,
        pct: totalCategoryRevenue > 0 ? Math.round((rev / totalCategoryRevenue) * 100) : 0,
        color: palette[idx % palette.length],
      }));

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    res.json({
      productCount,
      totalOrders,
      totalRevenue,
      monthly,
      categories,
      topProducts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customers derived from orders (no customer login exists), grouped by
// customerKey (email if available, otherwise phone — see orderModel.js).
app.get('/api/admin/customers', authenticateToken, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    const customerMap = {}; // customerKey -> aggregated customer record

    for (const order of orders) {
      const key = order.customerKey;
      if (!customerMap[key]) {
        customerMap[key] = {
          name: order.shipping.fullName,
          phone: order.shipping.phone,
          email: order.shipping.email || '',
          city: order.shipping.city,
          orders: 0,
          spent: 0,
          last: order.createdAt,
        };
      }
      customerMap[key].orders += 1;
      customerMap[key].spent += order.grandTotal;
      if (new Date(order.createdAt) > new Date(customerMap[key].last)) {
        customerMap[key].last = order.createdAt;
      }
    }

    const customers = Object.values(customerMap).sort((a, b) => b.spent - a.spent);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
