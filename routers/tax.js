const express = require("express");
const router = express.Router();
const { Tax } = require("../models/tax"); // Adjust the path to your tax model
const { verifyTokenAndAdmin } = require("./verifyToken");

router.post("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { taxname, percentage, isActive } = req.body;

    const newTax = new Tax({ taxname, percentage, isActive });

    const savedTax = await newTax.save();
    res.status(201).json(savedTax);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { taxname, percentage, isActive } = req.body;

    const updatedTax = await Tax.findByIdAndUpdate(
      id,
      { taxname, percentage, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedTax) {
      return res.status(404).json({ message: "Tax not found" });
    }

    res.status(200).json(updatedTax);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const taxes = await Tax.find();
    res.status(200).json(taxes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Tax.findByIdAndDelete(id);
    res.status(200).json("Tax deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/activeTaxes", async (req, res) => {
  try {
    const taxes = await Tax.find({ isActive: true });
    res.status(200).json(taxes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
