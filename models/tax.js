const mongoose = require("mongoose");

const taxSchema = mongoose.Schema(
  {
    taxname: {
      type: String,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
    },
  },
  { timestamps: true }
);

exports.Tax = mongoose.model("tax", taxSchema);
