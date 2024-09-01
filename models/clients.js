const mongoose = require("mongoose");

const clientSchema = mongoose.Schema({
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        birthDate: {
            type: Date,
            required: true
        },
        gender: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    }
);

exports.Client = mongoose.model("Client", clientSchema);

