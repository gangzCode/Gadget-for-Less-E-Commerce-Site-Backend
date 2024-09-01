const mongoose = require('mongoose');

const shippingPriceSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    countries: [
        {
            type: String,
            required: true,
        }
    ],
    priceVariations: [
        {
            weight: {
                type: Number,
                min: 0,
                required: true,
            },
            regularPrice: {
                type: Number,
                min: 0,
                required: true,
            },
            premiumPrice: {
                type: Number,
                min: 0,
                required: true,
            },
        }
    ]
})

exports.ShippingPrice = mongoose.model('ShippingPrice', shippingPriceSchema);
