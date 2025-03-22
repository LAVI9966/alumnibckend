// routes/events.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration"); // NEW
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const adminVerify = require("../middleware/adminVerify");

// 1) MULTER SETUP (if you want to upload event images)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "uploads");
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// 2) CREATE A NEW EVENT (ADMIN ONLY)
router.post("/", auth, admin, upload.single("image"), async (req, res) => {
  const { title, description, date } = req.body;
  try {
    const event = new Event({
      title,
      description,
      date,
      imageUrl: req.file ? req.file.filename : undefined,
      createdBy: req.user.id,
    });
    await event.save();
    res.status(201).json({ message: "Event created successfully!"});
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// 3) GET ALL EVENTS (ALL AUTHENTICATED USERS)
router.get("/", auth, async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 4) REGISTER FOR ONE OR MORE EVENTS (ONLY IF ADMIN-VERIFIED)
router.post("/register", auth, adminVerify, async (req, res) => {
  try {
    // Support both 'eventIds' (array) and 'eventId' (single id) in the request body.
    let { eventIds } = req.body;

    // if (!eventIds && req.body.eventId) {
    //   eventIds = [req.body.eventId];
    // }

    // Validate eventIds
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Provide a valid eventId or a non-empty array of eventIds." });
    }

    const userId = req.user.id;
    const registrations = [];

    for (const eventId of eventIds) {
      // 1. Check if the event exists
      const event = await Event.findById(eventId);
      if (!event) {
        return res
          .status(404)
          .json({ message: `Event with ID ${eventId} not found.` });
      }

      // 2. Check if the user is already registered
      const existingReg = await EventRegistration.findOne({
        user: userId,
        event: eventId,
      });
      if (existingReg) {
        return res
          .status(400)
          .json({ message: `Already registered for event ID: ${eventId}` });
      }

      // 3. Create a new registration
      const newReg = new EventRegistration({ user: userId, event: eventId });
      await newReg.save();
      registrations.push(newReg);
    }

    return res.status(201).json({
      message: "Successfully registered for events",
      registrations,
    });
  } catch (error) {
    console.error("Error registering for events:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 5) GET ALL REGISTRATIONS FOR A SPECIFIC EVENT (ADMIN ONLY)
router.get("/:eventId/registrations", auth, admin, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res
        .status(404)
        .json({ message: `Event with ID ${eventId} not found.` });
    }

    // Find all registrations for this event, populate user details
    const registrations = await EventRegistration.find({
      event: eventId,
    }).populate("user", "name email collegeNo");

    res.json({
      eventId,
      registrations,
    });
  } catch (error) {
    console.error("Error fetching event registrations:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// 6) GET ALL EVENTS THE CURRENT USER IS REGISTERED FOR
router.get("/my-registrations", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRegistrations = await EventRegistration.find({
      user: userId,
    }).populate("event");

    // userRegistrations is an array of { user, event, registeredAt }
    res.json({
      count: userRegistrations.length,
      registrations: userRegistrations,
    });
  } catch (error) {
    console.error("Error fetching my registrations:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// 7) UNREGISTER (DELETE REGISTRATION) FOR THE CURRENT USER
router.delete("/my-registrations/:registrationId", auth, async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user.id;

    // Find the registration record
    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found." });
    }

    // Ensure this registration belongs to the current user (or handle admin logic)
    if (registration.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to remove this registration." });
    }

    // Remove the registration
    await EventRegistration.findByIdAndDelete(registrationId);

    res.json({ message: "Successfully unregistered from the event." });
  } catch (error) {
    console.error("Error unregistering from event:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// 8) UPDATE AN EVENT (ADMIN ONLY)
router.put("/:id", auth, admin, upload.single("image"), async (req, res) => {
  const { title, description, date } = req.body;
  try {
    const updateData = { title, description, date };
    if (req.file) {
      updateData.imageUrl = req.file.filename;
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

// 9) DELETE AN EVENT (ADMIN ONLY)
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
