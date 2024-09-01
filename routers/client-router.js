const express = require('express');
const router = express.Router();
const {auth0Verify} = require("./auth0-verify");
const {Client} = require("../models/clients");
const {ClientAddress} = require("../models/clients-address");

router.post("/saveUserDetails", auth0Verify, async (req, res) => {
    try {
        let client = await Client.findOne({email: req.body.email}, {email:1})
        if (client) {
            await Client.findOneAndUpdate({email: req.body.email}, req.body)
        } else {
            let newClient = new Client(req.body)
            client = await newClient.save()
        }
        res.status(200).json(client);
    } catch (err) {
        return res.status(500).json(err);
    }
});

router.post("/findUserDetails", auth0Verify, async (req, res) => {
    try {
        let client = await Client.findOne({email: req.body.email})
        res.status(200).json(client);
    } catch (err) {
        return res.status(500).json(err);
    }
});

router.post("/saveUserAddress", auth0Verify, async (req, res) => {
    try {
        if (req.body._id) {
            if (req.body.isDefault) {
                await ClientAddress.updateMany({email: req.body.email}, {isDefault: false})
            }
            await ClientAddress.findByIdAndUpdate(req.body._id, req.body)
        } else {
            if (req.body.isDefault) {
                await ClientAddress.updateMany({email: req.body.email}, {isDefault: false})
            }
            let address = new ClientAddress(req.body)
            await address.save()
        }
        res.status(200).json({success:true});
    } catch (err) {
        return res.status(500).json(err);
    }
});

router.post("/findUserAddress", auth0Verify, async (req, res) => {
    try {
        let client = await ClientAddress.find({email: req.body.email})
        res.status(200).json(client);
    } catch (err) {
        return res.status(500).json(err);
    }
});

router.post("/deleteAddress", auth0Verify, async (req, res) => {
    try {
        let client = await ClientAddress.findByIdAndDelete(req.body.addressId)
        res.status(200).json(client);
    } catch (err) {
        return res.status(500).json(err);
    }
});

module.exports = router;
