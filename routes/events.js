// routes/events.js
const express = require('express');
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');


// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads'); 
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// Create a new event (admin only) with image upload support
router.post('/', auth, admin, upload.single('image'), async (req, res) => {
  const { title, description, date } = req.body;
  try {
    // Create a new event and store the image path if provided
    const event = new Event({
      title,
      description,
      date,
      imageUrl: req.file ? req.file.path : undefined,
      createdBy: req.user.id,
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all events (all authenticated users)
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an event (admin only)
router.put("/:id", auth, admin, upload.single("image"), async (req, res) => {
  const { title, description, date } = req.body;
  try {
    // Build the update object
    const updateData = { title, description, date };
    // If an image file is provided, add the imageUrl to updateData
    if (req.file) {
      updateData.imageUrl = req.file.path;
    }

    const event = await Event.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// Delete an event (admin only)
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;