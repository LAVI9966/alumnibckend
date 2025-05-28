// routes/events.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const Event = require("../models/Event");
const User = require("../models/User"); // Added User model
const EventRegistration = require("../models/EventRegistration");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const adminVerify = require("../middleware/adminVerify");

// Configure nodemailer for sending email (same as in auth.js)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Function to send event notification email to all users for a new event
const sendEventNotificationToAllUsers = async (event) => {
  try {
    // Get all verified users
    const users = await User.find({ isVerified: true });
    if (users.length === 0) {
      console.log('No users found to send notifications');
      return;
    }

    const emailSubject = `🎉 New Event: ${event.title}`;
    const emailContent = `
Dear Alumni,

We're excited to announce a new event!

EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Event: ${event.title}
📝 Description: ${event.description}
🗓️ Date & Time: ${new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a great opportunity to learn, network, and grow. We encourage you to participate!

To view more details, please log in to your account.

Best regards,
The Alumni Event Management Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification. Please do not reply to this email.
For queries, contact our support team.
    `;

    // Send email to each user
    const emailPromises = users.map(user => {
      return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: emailSubject,
        text: emailContent
      });
    });

    await Promise.all(emailPromises);
    console.log(`Event notification emails sent to ${users.length} users`);
  } catch (error) {
    console.error('Error sending event notification emails:', error);
  }
};

// Function to send event notification email to all registered users for an event (existing)
const sendEventNotificationToRegisteredUsers = async (event, isUpdate = false) => {
  try {
    // Get all registrations for this event, and populate user info
    const registrations = await EventRegistration.find({ event: event._id }).populate('user');
    const users = registrations.map(reg => reg.user).filter(user => user && user.isVerified);

    if (users.length === 0) {
      console.log('No registered users found to send notifications');
      return;
    }

    // Create email content based on whether it's new or updated
    const emailSubject = isUpdate
      ? `📝 Event Update: ${event.title}`
      : `🎉 New Event: ${event.title}`;

    const emailContent = `
Dear Event Enthusiast,

${isUpdate
        ? `We wanted to inform you about important updates to an upcoming event you registered for.`
        : `We're excited to announce a new event that you registered for!`
      }

EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Event: ${event.title}
📝 Description: ${event.description}
🗓️ Date & Time: ${new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${isUpdate
        ? `Please review the updated details and make any necessary adjustments to your schedule.`
        : `This is a great opportunity to learn, network, and grow. We encourage you to participate!`
      }

To view more details, please log in to your account.

Best regards,
The Alumni Event Management Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification. Please do not reply to this email.
For queries, contact our support team.
    `;

    // Send email to each registered user
    const emailPromises = users.map(user => {
      return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: emailSubject,
        text: emailContent,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
            <div style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <!-- Header Section -->
              <div style="background-color: #4a90e2; padding: 25px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px; font-weight: normal;">${isUpdate ? '📝 Event Update' : '🎉 New Event'}</h1>
                <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
                  ${isUpdate ? 'Important updates to your event' : 'You registered for this event!'}
                </p>
              </div>
              <!-- Main Content -->
              <div style="padding: 30px;">
                <div style="text-align: center; margin-bottom: 25px;">
                  <h2 style="color: #333; margin: 0; font-size: 22px; font-weight: normal;">${event.title}</h2>
                  <div style="width: 50px; height: 2px; background-color: #4a90e2; margin: 10px auto;"></div>
                </div>
                <!-- Event Details -->
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 25px;">
                  <p style="margin: 0 0 10px 0; color: #555; line-height: 1.5;"><span style="color: #333;">Description:</span> ${event.description}</p>
                  <p style="margin: 0; color: #555; line-height: 1.5;"><span style="color: #333;">Date & Time:</span> ${new Date(event.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
                </div>
                <!-- Message Section -->
                <div style="text-align: center; margin-bottom: 25px;">
                  <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0;">
                    ${isUpdate
            ? 'Please review the updated details and make any necessary adjustments to your schedule.'
            : 'This is a great opportunity to learn, network, and grow. We encourage you to participate!'
          }
                  </p>
                </div>
              </div>
            </div>
          </div>
        `
      });
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);
    console.log(`Event notification emails sent to ${users.length} registered users`);

  } catch (error) {
    console.error('Error sending event notification emails:', error);
    // Don't throw the error to prevent event creation from failing
  }
};

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

// 2) CREATE A NEW EVENT (ADMIN ONLY) - UPDATED WITH EMAIL NOTIFICATIONS
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

    // Save the event
    await event.save();

    // Add this event to all users' events array
    await User.updateMany(
      {}, // Target all users
      { $push: { events: event._id } }
    );

    // Create in-app notifications for all users
    const Notification = require("../models/Notification");
    const users = await User.find({ isVerified: true });
    const notifications = users.map(user => ({
      user: user._id,
      type: "event",
      event: event._id,
      message: `New event: ${event.title}`
    }));
    await Notification.insertMany(notifications);

    // (No automatic email on event creation)

    res.status(201).json({
      message: "Event created successfully and notifications sent to all users",
      event: event
    });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// 3) GET ALL EVENTS (ALL AUTHENTICATED USERS)
router.get("/", auth, async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// NEW - GET USER EVENTS (FOR NOTIFICATION PAGE)
router.get("/user-events", auth, async (req, res) => {
  try {
    // Find the current user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If the user has no events array or it's empty
    if (!user.events || user.events.length === 0) {
      return res.json([]);
    }

    // Get all event details from user's events array
    const events = await Event.find({
      _id: { $in: user.events }
    }).sort({ createdAt: -1 }); // Sort by creation date, newest first

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW - DISMISS USER EVENT (REMOVE EVENT FROM USER'S LIST)
router.delete("/user-events/:eventId", auth, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Find the current user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove the event from the user's events array
    if (user.events) {
      user.events = user.events.filter(id => id.toString() !== eventId);
      await user.save();
    }

    res.json({ message: 'Event dismissed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// 4) REGISTER FOR ONE OR MORE EVENTS (ONLY IF ADMIN-VERIFIED)
router.post("/register", auth, adminVerify, async (req, res) => {
  try {
    // Support both 'eventIds' (array) and 'eventId' (single id) in the request body.
    let { eventIds } = req.body;

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

// 8) UPDATE AN EVENT (ADMIN ONLY) - UPDATED WITH EMAIL NOTIFICATIONS
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

    // Create in-app notifications for all users about the update
    const Notification = require("../models/Notification");
    const users = await User.find({ isVerified: true });
    const notifications = users.map(user => ({
      user: user._id,
      type: "event",
      event: event._id,
      message: `Event updated: ${event.title}`
    }));
    await Notification.insertMany(notifications);
    // (No automatic email on event update)

    res.json({
      message: "Event updated successfully and notifications sent to all users",
      event: event
    });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// Admin: Send event email to all users on demand (top-level route, not nested)
// Admin: Send event email to all users on demand
router.post("/:id/send-email", auth, admin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    await sendEventNotificationToAllUsers(event);
    res.json({ message: `Event email sent to all users` });
  } catch (err) {
    res.status(500).json({ message: "Failed to send event email", error: err.message });
  }
});

// 9) DELETE AN EVENT (ADMIN ONLY)
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Also remove this event from all users' events arrays
    await User.updateMany(
      {},
      { $pull: { events: req.params.id } }
    );

    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//10 get single event by id
// GET a single event by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;           