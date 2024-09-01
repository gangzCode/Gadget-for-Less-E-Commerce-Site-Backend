const mongoose = require('mongoose');

const filterSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    showAsCard: {
        type: Boolean,
    },
    tagLine: {
        type: String,
    },
    image: {
        type: String,
        default: ''
    },
    filterGroup: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FilterGroup'
    }
})

exports.Filter = mongoose.model('Filter', filterSchema);
