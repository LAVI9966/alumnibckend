// routes/contact.js
const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// Handle contact form submissions
router.post('/', async (req, res) => {
  try {
    const { name, subject, email, message } = req.body;

    const newContact = new Contact({
      name,
      subject,
      email,
      message,
    });
    await newContact.save();

    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;