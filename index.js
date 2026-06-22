console.log('SCRIPT STARTED - LINE 1');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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