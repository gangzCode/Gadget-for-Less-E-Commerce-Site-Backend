const express = require('express');
const router = express.Router();
const { Wishlist } = require("../models/wishlist");
const { Product } = require("../models/product");
const { auth0Verify } = require("./auth0-verify");

// CREATE
router.post("/", auth0Verify, async (req, res) => {
  try {
    const { product, username } = req.body;

    const productData = await Product.findById(product);
    if (!productData) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existingWishlistItem = await Wishlist.findOne({ username, product });
    if (existingWishlistItem) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    let newWishlist = new Wishlist({
      username,
      product,
    });

    const savedWishlist = await newWishlist.save();
    res.status(200).json(savedWishlist);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE
router.post("/delete", auth0Verify, async (req, res) => {
  try {
    await Wishlist.findByIdAndDelete(req.body.wishlistId);
    return res.status(200).json("Wishlist has been deleted...");
  } catch (err) {
    return res.status(500).json(err);
  }
});

// CLEAR WISHLIST
router.post("/clearWishlist", auth0Verify, async (req, res) => {
  try {
    await Wishlist.deleteMany({username: req.body.username});
    return res.status(200).json("Wishlist has been cleared...");
  } catch (err) {
    return res.status(500).json(err);
  }
});

// GET USER WISHLIST
router.post("/find", auth0Verify, async (req, res) => {
  try {
    let wishlist = await Wishlist.find({ username: req.body.username }).populate('product', {
      _id: 1, name: 1, price: 1, discountedPrice: 1, image: 1, imageAlt: 1, description: 1, variations: 1, isNumericVariation: 1
    });

    let wishlistArray = [];
    for (let item of wishlist) {
      let wishlistItem = item.toJSON();

      if (item.product && item.product.variations) {
        // Assuming we want the first variation for display purposes
        const firstVariation = item.product.variations[0];
        wishlistItem.stockSize = firstVariation.quantity;
        wishlistItem.price = firstVariation.price;
        wishlistItem.discountedPrice = firstVariation.discountedPrice;
      } else {
        wishlistItem.stockSize = null;
        wishlistItem.price = null;
        wishlistItem.discountedPrice = null;
      }

      wishlistArray.push(wishlistItem);
    }

    return res.status(200).json(wishlistArray);
  } catch (err) {
    console.error("Error occurred:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET ALL WISHLISTS
router.get("/", auth0Verify, async (req, res) => {
  try {
    const wishlists = await Wishlist.find();
    return res.status(200).json(wishlists);
  } catch (err) {
    return res.status(500).json(err);
  }
});

module.exports = router;