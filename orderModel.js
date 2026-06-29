const mongoose = require('mongoose');

// One line item within an order. We SNAPSHOT the product's name/price/image
// at the moment of purchase — never reference live Product data for these,
// because if the admin edits or deletes a product later, past orders must
// still show exactly what the customer actually bought and paid for.
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: '',
  },
  price: {
    // Unit price at time of purchase (snapshot, in rupees)
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  subtotal: {
    // price * quantity, stored explicitly so totals never depend on
    // re-computing from possibly-changed data later.
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

// Shipping / contact details. The storefront has no customer login, so this
// is the ONLY record of who placed the order — captured directly at checkout.
const shippingInfoSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  addressLine1: {
    type: String,
    required: true,
    trim: true,
  },
  addressLine2: {
    type: String,
    trim: true,
    default: '',
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    required: true,
    trim: true,
  },
  pincode: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Optional — only set if a logged-in admin/user account placed the order.
  // Will be null/undefined for the vast majority of real orders, since
  // customers check out as guests by design.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0,
      message: 'An order must contain at least one item.',
    },
  },

  shipping: {
    type: shippingInfoSchema,
    required: true,
  },

  itemsTotal: {
    // Sum of all item subtotals, before shipping/tax adjustments.
    type: Number,
    required: true,
    min: 0,
  },

  shippingFee: {
    type: Number,
    default: 0,
    min: 0,
  },

  totalAmount: {
    // itemsTotal + shippingFee. The authoritative amount the customer owes.
    type: Number,
    required: true,
    min: 0,
  },

  paymentMethod: {
    type: String,
    enum: ['cod', 'razorpay'],
    default: 'cod',
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },

  // Razorpay fields — left empty until that integration is added.
  // Kept here now so adding Razorpay later doesn't require a schema migration.
  razorpayOrderId: {
    type: String,
    default: null,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  razorpaySignature: {
    type: String,
    default: null,
  },

  orderStatus: {
    type: String,
    enum: ['processing', 'shipped', 'delivered', 'cancelled'],
    default: 'processing',
  },

  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Useful for admin dashboard lookups (recent orders, status filtering).
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'shipping.phone': 1 });
orderSchema.index({ orderStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);