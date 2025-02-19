// routes/events.js
const express = require('express');
const router = express.Router();

const Event = require('../models/Event');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Create a new event (admin only)
router.post('/', auth, admin, async (req, res) => {
  const { title, description, date } = req.body;
  try {
    const event = new Event({
      title,
      description,
      date,
      createdBy: req.user.id
    });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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
router.put('/:id', auth, admin, async (req, res) => {
  const { title, description, date } = req.body;
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { title, description, date },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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