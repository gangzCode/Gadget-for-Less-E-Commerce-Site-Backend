const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true
    },
    richDescription: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    imageAlt: {
        type: String,
        default: ''
    },
    otherImages: [
        {
            type: String,
            default: ''
        }
    ],
    isNumericVariation: {
        type: Boolean,
        default: true
    },
    type:{
        type: String,
        default: ''
    },
    variations:[
        {
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
    ],
    specifications:[
        {
            name: {
                type: String,
                default: ''
            },
            value: {
                type: String,
                default: ''
            }, 
        }
    ],
    brand: {
        type: String,
        default: ''
    },
    purchaseCount: {
        type: Number,
        default: 0,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory'
    },
    innerSubCategory: {
        type: String,
        required:false
    },
    filterList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Filter',
        required:false
    }],
    /*countInStock: {
        type: Number,
        required: true,
        min: 0,
        max: 255
    },*/
    rating: {
        type: Number,
        default: 0,
    },
    numReviews: {
        type: Number,
        default: 0,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    dateCreated: {
        type: Date,
        default: Date.now,
    },
})

// productSchema.virtual('id').get(function () {
//     return this._id.toHexString();
// });

// productSchema.set('toJSON', {
//     virtuals: true,
// });

exports.Product = mongoose.model('Product', productSchema);
