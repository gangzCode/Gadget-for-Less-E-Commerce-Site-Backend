const mongoose = require('mongoose');

const filterGroupSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    filters: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Filter'
        }
    ]
})

// categorySchema.virtual('id').get(function () {
//     return this._id.toHexString();
// });

// categorySchema.set('toJSON', {
//     virtuals: true,
// });

exports.FilterGroup = mongoose.model('FilterGroup', filterGroupSchema);
