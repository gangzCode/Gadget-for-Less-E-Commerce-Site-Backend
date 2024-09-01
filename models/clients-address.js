const mongoose = require("mongoose");

const clientAddressSchema = mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    number: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    town: {
        type: String,
        required: true
    },
    isDefault: {
        type: Boolean,
        required: true,
        default: false
    }
});

exports.ClientAddress = mongoose.model("ClientAddress", clientAddressSchema);

