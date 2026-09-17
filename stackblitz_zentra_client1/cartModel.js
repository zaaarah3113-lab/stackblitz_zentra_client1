const mongoose = require('mongoose');

// One line in a cart. Unlike Order items, cart items do NOT snapshot price —
// the cart should always reflect the *current* live price/stock, since
// nothing has been purchased yet. Price is resolved fresh from Product at
// read/checkout time, never trusted from what's stored here.
const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  // The guest session identifier, stored in an HTTP-only cookie on the
  // customer's browser. This is the cart's primary key for anonymous
  // shoppers — there is no login, so this is the only handle we have.
  guestId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Left null for guest carts. If/when customer accounts are introduced,
  // logging in can set this field and the guestId cart gets merged into
  // (or promoted to) a user-owned cart — no schema change needed, just
  // application logic added later.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  items: {
    type: [cartItemSchema],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);