const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Product = require('./productModel'); // Import your new product blueprint!

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Connect to MongoDB Atlas Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Database connected perfectly for Maas Trends!"))
  .catch((err) => console.error("Database connection error: ", err));

// --- API ROUTES ---

// 1. CREATE Route (Used by Admin Portal to upload a product)
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// 2. READ Route (Used by User Storefront to display all products)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Base Testing Route
app.get('/api/test', (req, res) => {
    res.json({ message: "Welcome to Maas Trends Backend! The cloud server is running beautifully!" });
});

// Start listening
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});