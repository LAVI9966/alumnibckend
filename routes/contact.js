const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// Handle contact form submissions
router.post('/', async (req, res) => {
  try {
    const { name, subject, email, message, department } = req.body;

    // Validate the required fields
    if (!name || !subject || !email || !message || !department) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newContact = new Contact({
      name,
      subject,
      email,
      message,
      department, // Save the department field
    });

    await newContact.save();
    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all contact form submissions
router.get('/', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }); // Sort by newest first
    res.status(200).json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;