console.log('SCRIPT STARTED - LINE 1');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Product = require('./productModel');
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
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE a new product
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE an existing product
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

console.log('ROUTES DEFINED - ABOUT TO START SERVER FUNCTION');

async function startServer() {
  console.log('INSIDE STARTSERVER - BEFORE MONGOOSE CONNECT');
  console.log(
    'MONGO_URI value is:',
    process.env.MONGO_URI ? 'DEFINED (hidden for safety)' : 'UNDEFINED'
  );
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('MongoDB Atlas connected successfully for Maas Trends!');

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
