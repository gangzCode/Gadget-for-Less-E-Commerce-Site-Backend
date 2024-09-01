const mongoose = require('mongoose');

const subCategorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    showInNav: {
        type: Boolean,
        required: true,
    },
    image: {
        type: String,
        default: ''
    },
    innerCategories: [
        {
            name: {
                type: String,
                required: true,
            },
        }
    ]
})

exports.SubCategory = mongoose.model('SubCategory', subCategorySchema);
