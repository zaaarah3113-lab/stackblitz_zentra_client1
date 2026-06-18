require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Added this to talk to your database

const app = express();
// IDX usually gives us a specific port, or we default to 5000
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Connect to MongoDB Atlas Database
mongoose.connect('mongodb+srv://zaaarah3113_db_user:nahnahZAARAH@cluster0.hqgpxrb.mongodb.net/Zentra-Client-1s?retryWrites=true&w=majority&appName=Cluster0', { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("MongoDB Database connected perfectly for Maas Trends!"))
  .catch((err) => console.error("Database connection error: ", err));

// Base Testing Route
app.get('/api/test', (req, res) => {
    res.json({ message: "Welcome to Maas Trends Backend! The cloud server is running beautifully!" });
});

// Start listening
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
