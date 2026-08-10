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

// The Admin portal only ever sets `stockStatus` (a text dropdown) — it never
// touches the numeric `stock` field directly. That mismatch is what caused
// products to show "In Stock" in Admin while the User portal's numeric
// quantity check saw `stock: 0` and blocked "Add to Cart".
//
// This hook keeps the two fields in sync so they can never diverge again:
//   - "Out of Stock"           -> stock forced to 0
//   - "In Stock" / "Low Stock" -> if stock is still 0 (untracked), give it a
//                                  sane default so the numeric check never
//                                  silently blocks a purchase
productSchema.pre('save', function syncStockWithStatus(next) {
  if (this.isModified('stockStatus')) {
    if (this.stockStatus === 'Out of Stock') {
      this.stock = 0;
    } else if (!this.stock) {
      this.stock = this.stockStatus === 'Low Stock' ? 5 : 100;
    }
  } else if (this.isNew && !this.stock) {
    this.stock = this.stockStatus === 'Out of Stock' ? 0 : 100;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);