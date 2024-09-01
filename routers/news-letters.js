const { NewsLetter } = require("../models/news-letter");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const validator = require("email-validator");
// const {sendContactUsEmail} = require("../report/mailgun");
const { sendContactUsEmail } = require("../report/nodemailer");

router.post(`/`, async (req, res) => {
  if (!validator.validate(req.body.email)) {
    return res.status(400).send({ success: false, message: "Enter a proper E-mail" });
  } else {
    const existingEmail = await NewsLetter.findOne({ email: req.body.email });
    if (existingEmail) {
      return res.status(200).send({ success: false });
    } else {
      let email = new NewsLetter({
        email: req.body.email,
      });
      email = await email.save();
      return res.status(200).send({ success: true });
    }
  }
});

router.post(`/inquire`, async (req, res) => {
  try {
    await sendContactUsEmail(req.body.name, req.body.email, req.body.phone, req.body.message);
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

router.get(`/`, async (req, res) => {
  const emailList = await NewsLetter.find();

  if (!emailList) {
    res.status(500).json({ success: false });
  }
  res.send(emailList);
});

router.delete("/:id", (req, res) => {
  NewsLetter.findByIdAndDelete(req.params.id)
    .then((email) => {
      if (email) {
        return res.status(200).json({ success: true, message: "the subscriber is deleted!" });
      } else {
        return res.status(404).json({ success: false, message: "subscriber not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

module.exports = router;
