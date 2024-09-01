const mongoose = require("mongoose");

const wishlistSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    }
  },
  { timestamps: true }
);

exports.Wishlist = mongoose.model("wishlist", wishlistSchema);