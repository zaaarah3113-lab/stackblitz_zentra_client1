const mongoose = require('mongoose');

// This blueprint matches the structure your frontends expect!
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "A product must have a name"]
    },
    price: {
        type: Number,
        required: [true, "A product must have a price"]
    },
    image: {
        type: String, // Stores the image URL string
        required: [true, "A product must have an image link"]
    },
    category: {
        type: String,
        default: "General"
    },
    description: {
        type: String,
        default: ""
    },
    stock: {
        type: Number,
        default: 10
    }
}, { timestamps: true }); // Automatically tracks when products are added or updated

module.exports = mongoose.model('Product', productSchema);