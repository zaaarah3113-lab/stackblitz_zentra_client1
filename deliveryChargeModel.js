const mongoose = require('mongoose');

const deliveryChargeSchema = new mongoose.Schema({
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    unique: true,
    trim: true,
  },
  areaName: {
    type: String,
    trim: true,
    default: '',
  },
  deliveryCharge: {
    type: Number,
    required: [true, 'Delivery charge is required'],
    min: 0,
  },
}, { timestamps: true });

deliveryChargeSchema.index({ pincode: 1 });

module.exports = mongoose.model('DeliveryCharge', deliveryChargeSchema);
