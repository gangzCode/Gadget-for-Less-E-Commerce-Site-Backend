const mongoose = require('mongoose');

const categorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    icon: {
        type: String,
    },
    color: { 
        type: String,
    },
    showInNav: {
        type: Boolean,
    },
    subCategory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubCategory'
        }
    ]
})

// categorySchema.virtual('id').get(function () {
//     return this._id.toHexString();
// });

// categorySchema.set('toJSON', {
//     virtuals: true,
// });

exports.Category = mongoose.model('Category', categorySchema);
