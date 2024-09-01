const express = require("express");
const router = express.Router();
const { Cart } = require("../models/cart");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const { auth0Verify } = require("./auth0-verify");
const { Product } = require("../models/product");
const { Tax } = require("../models/tax");

//CREATE
router.post("/", auth0Verify, async (req, res) => {
  try {
    const { product, variation, quantity, username } = req.body;

    const productData = await Product.findById(product);
    if (!productData) {
      return res.status(404).json({ message: "Product not found" });
    }

    const variationData = productData.variations.id(variation);
    if (!variationData) {
      return res.status(404).json({ message: "Variation not found" });
    }

    const existingCartItem = await Cart.findOne({ username, product, variation });
    if (existingCartItem) {
      return res.status(400).json({ message: "Product already in cart" });
    }

    let newCart = new Cart({
      username,
      product,
      variation: variationData._id,
      quantity,
      variationDetails: {
        sku: variationData.sku,
        name: variationData.name,
        quantity: variationData.quantity,
        cost: variationData.cost,
        price: variationData.price,
        discountedPrice: variationData.discountedPrice,
      },
    });

    // Save the new cart entry to the database
    const savedCart = await newCart.save();

    // Send the response
    res.status(200).json(savedCart);
  } catch (err) {
    return res.status(500).json(err);
  }
});

//UPDATE
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const updatedCart = await Cart.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true }
    );
    res.status(200).json(updatedCart);
  } catch (err) {
    return res.status(500).json(err);
  }
});

//DELETE
router.post("/delete", auth0Verify, async (req, res) => {
  try {
    await Cart.findByIdAndDelete(req.body.cartId);
    return res.status(200).json("Cart has been deleted...");
  } catch (err) {
    return res.status(500).json(err);
  }
});

//update
router.post("/update", auth0Verify, async (req, res) => {
  try {
    let cartArray = req.body;
    await Cart.bulkWrite(
      cartArray.map((data) => ({
        updateOne: {
          filter: { _id: data._id },
          update: { quantity: data.quantity },
        },
      }))
    );
    return res.status(200).json("Cart has updated");
  } catch (err) {
    return res.status(500).json(err);
  }
});

//DELETE
router.post("/clearCart", auth0Verify, async (req, res) => {
  try {
    await Cart.deleteMany({ username: req.body.username });
    return res.status(200).json("Cart has been cleared...");
  } catch (err) {
    return res.status(500).json(err);
  }
});

//GET USER CART
router.post("/find", auth0Verify, async (req, res) => {
  try {
    let cart = await Cart.find({ username: req.body.username }).populate("product", {
      _id: 1,
      name: 1,
      price: 1,
      discountedPrice: 1,
      image: 1,
      imageAlt: 1,
      description: 1,
      variations: 1,
      isNumericVariation: 1,
    });

    let cartArray = [];
    let tempPrice = null;
    let tempDiscountedPrice = null;

    for (let item of cart) {
      let cartItem = item.toJSON();
      if (item.product && item.product.variations) {
        // for (let variation of item.product.variations) {
        //   cartItem.stockSize = variation.quantity;
        //   cartItem.price = variation.price;
        //   cartItem.discountedPrice = variation.discountedPrice;
        //   break;
        // }
        cartItem.stockSize = cartItem.variationDetails.quantity;
        cartItem.price = cartItem.variationDetails.price;
        cartItem.discountedPrice = cartItem.variationDetails.discountedPrice;
      } else {
        cartItem.stockSize = null;
        cartItem.price = null;
        cartItem.discountedPrice = null;
      }

      item.product.price = tempPrice;
      item.product.discountedPrice = tempDiscountedPrice;
      cartArray.push(cartItem);
    }

    return res.status(200).json(cartArray);
  } catch (err) {
    console.error("Error occurred:", err);
    return res.status(500).json({ error: err.message });
  }
});

// //GET ALL
router.get("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const carts = await Cart.find();
    return res.status(200).json(carts);
  } catch (err) {
    return res.status(500).json(err);
  }
});

module.exports = router;
