const mongoose = require("mongoose");

const orderSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientAddress",
      required: true,
    },
    delivery: {
      type: String,
      required: true,
    },
    orderItems: [
      {
        _id: false,
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variationId: {
          type: String,
          required: true,
        },
        variationName: {
          type: String,
          required: true,
        },
        itemQuantity: {
          type: Number,
          required: true,
        },
        itemPrice: {
          type: Number,
          required: true,
        },
        itemDiscountedPrice: {
          type: Number,
          required: false,
        },
      },
    ],
    rawTotal: {
      type: Number,
      required: true,
    },
    discounts: {
      type: Number,
      required: true,
    },
    shipping: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "P",
    },
    tracking: {
      type: String,
    },
    remark: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    grossTotal: {
      type: Number,
      required: true,
    },
    grossTax: {
      type: Number,
      required: true,
    },
    taxes: [
      {
        _id: false,
        taxId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Tax",
          required: true,
        },
        taxname: {
          type: String,
          required: true,
        },
        percentage: {
          type: Number,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

exports.Order = mongoose.model("Order", orderSchema);
