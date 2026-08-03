const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A product must have a name'],
  },
  price: {
    type: Number,
    required: [true, 'A product must have a price'],
  },
  image: {
    type: String,
    required: [true, 'A product must have an image link'],
  },
  category: {
    type: String,
    default: 'General',
  },
  description: {
    type: String,
    default: '',
  },
  mrp: {
    type: Number,
    default: 0,
  },
  fabric: {
    type: String,
    default: '',
  },
  care: {
    type: String,
    default: '',
  },
  stock: {
    type: Number,
    default: 10,
    min: 0,
  },
  stockStatus: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'In Stock',
  },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
