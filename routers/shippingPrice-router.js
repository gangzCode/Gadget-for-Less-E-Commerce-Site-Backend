const express = require('express');
const router = express.Router();
const {
    verifyTokenAndAdmin,
} = require("./verifyToken");
const {ShippingPrice} = require("../models/shippingPrice");

router.get(`/getShippingPrices`, async (req, res) =>{
    try {
        let shippingPriceList = []
        shippingPriceList = await ShippingPrice.find();
        if (!shippingPriceList) {
            return res.status(500).json({success: false})
        }
        if (shippingPriceList.length === 0) {
            let shippingPrice = new ShippingPrice({
                name: 'Rest of the World',
                countries: ['*'],
                priceVariations: [
                    {
                        weight:0.5,
                        regularPrice:39.99,
                        premiumPrice:42.99,
                    },
                    {
                        weight:30,
                        regularPrice:113.99,
                        premiumPrice:133.99,
                    },
                ]
            })
            shippingPrice.save();
        }
        res.status(200).send(shippingPriceList);
    } catch (e) {
        console.error(e)
        return res.status(500).json({success: false})
    }
})

router.post('/saveData', verifyTokenAndAdmin, async (req,res)=>{
    try {
        let shippingPrice;
        if (req.body._id) {
            shippingPrice = await ShippingPrice.findByIdAndUpdate(req.body._id, {
                name: req.body.name,
                countries: req.body.countries,
                priceVariations: req.body.priceVariations,
            });
        } else {
            shippingPrice = new ShippingPrice({
                name: req.body.name,
                countries: req.body.countries,
                priceVariations: req.body.priceVariations,
            });
            shippingPrice = await shippingPrice.save();
        }
        if(!shippingPrice)
            return res.status(400).send('the sub category cannot be created!')
        res.send(shippingPrice);
    } catch (e) {
        console.error(e)
        return res.status(500).json({success: false})
    }
})
router.post('/deleteData', verifyTokenAndAdmin, async (req,res)=>{
    try {
        await ShippingPrice.findByIdAndDelete(req.body._id);
        return res.status(200).json({success: true})
    } catch (e) {
        console.error(e)
        return res.status(500).json({success: false})
    }
})

module.exports =router;
