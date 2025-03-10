const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const User = require("../models/User");
const Event = require("../models/Event");

// Get total alumni and total users
router.get("/users-stats", auth, admin, async (req, res) => {
  try {
    const totalAlumni = await User.countDocuments({ role: "alumni" });
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalEvents = await Event.find().count();
    res.json({
      totalAlumni,
      totalUsers,
      totalEvents
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get upcoming events count
router.get("/upcoming-events", auth, admin, async (req, res) => {
  try {
    const currentDate = new Date();
    const upcomingEvents = await Event.countDocuments({
      date: { $gte: currentDate },
    });

    res.json({ upcomingEvents });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
