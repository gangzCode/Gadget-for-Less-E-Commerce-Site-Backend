const mongoose = require("mongoose");

const cartSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variation: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    variationDetails: {
      sku: {
        type: String,
        default: ''
      },
      name: {
        type: String,
        default: ''
      },
      quantity: {
        type: Number,
        min: 0
      },
      cost: {
        type: Number,
        min: 0
      },
      price: {
        type: Number,
        min: 0
      },
      discountedPrice: {
        type: Number,
        min: 0
      },
    }
  },
  { timestamps: true }
);

exports.Cart = mongoose.model("Cart", cartSchema);