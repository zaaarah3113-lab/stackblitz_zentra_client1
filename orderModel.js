const mongoose = require('mongoose');

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
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

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
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  customerKey: {
    type: String,
    default: '',
  },

  guestId: {
    type: String,
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

  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },

  shippingFee: {
    type: Number,
    default: 0,
    min: 0,
  },

  discount: {
    type: Number,
    default: 0,
    min: 0,
  },

  tax: {
    type: Number,
    default: 0,
    min: 0,
  },

  grandTotal: {
    type: Number,
    required: true,
    min: 0,
  },

  // Legacy alias kept for older admin UI references
  itemsTotal: {
    type: Number,
    min: 0,
  },

  totalAmount: {
    type: Number,
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
    enum: ['awaiting_payment', 'order_placed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'order_placed',
  },

  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

orderSchema.pre('save', function syncLegacyTotals(next) {
  this.itemsTotal = this.subtotal;
  this.totalAmount = this.grandTotal;
  next();
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'shipping.phone': 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('Order', orderSchema);
