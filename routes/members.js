// routes/members.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const admin = require('../middleware/admin');
const nodemailer = require('nodemailer');

// Configure nodemailer for sending email
const transporter = nodemailer.createTransport({
  service: 'Gmail', // or another email service
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,       // e.g. "myemail@gmail.com"
    pass: process.env.EMAIL_PASSWORD,   // your app password or real password
  },
  tls: {
    rejectUnauthorized: false,
  },
});



// Get all members (authenticated users) 
router.get('/', auth, async (req, res) => {
  try {
    // Exclude password hash
    const members = await User.find({}, { password: 0 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * 2. Get all members (Admin only)
 *    - Admins can fetch all users separately
 */
router.get('/admin', auth, admin, async (req, res) => {
  try {

    const members = await User.find({}, { password: 0 }).sort({ createdAt: -1 });

    res.json(members);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single member by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const member = await User.findById(req.params.id, { password: 0 });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * 3. Create a new member (Admin only)
 */
router.post('/', auth, admin, async (req, res) => {
  const { collegeNo, name, email, mobileNumber, password, role } = req.body;

  try {
    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Create new user
    const newUser = new User({
      collegeNo,
      name,
      email,
      mobileNumber,
      password, // Will be hashed automatically before saving
      role: role || 'user',
      isVerified: true, // Admin-created users are verified by default
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * 4. Update a member (Admin only)
 */
router.put('/:id', auth, admin, async (req, res) => {
  const { collegeNo, name, email, mobileNumber, role } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { collegeNo, name, email, mobileNumber, role },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PATCH /api/members/:id/verify
 * Admin-only endpoint to verify a user.
 * This sets user.isVerified to true and updates the status field to "verified".
 */
router.patch("/:id/verify", auth, admin, async (req, res) => {
  try {
    const { status } = req.body;

    console.log("Verify request:", {
      userId: req.params.id,
      newStatus: status,
      body: req.body
    });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!["pending", "verified"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Update status and isVerified
    user.status = status;
    user.isVerified = status === "verified";
    await user.save();

    // Define login link (adjust URL as needed)
    const loginLink = `${process.env.FRONTEND_URL}/login`;

    // Define message based on status
    const subject = status === "verified"
      ? "Your account has been verified!"
      : "Your account verification status has changed";

    const message = status === "verified"
      ? `Hello ${user.name},\n\nYour account has been successfully verified by the admin. You can now log in and use all features.\n\nGo to login: ${loginLink}`
      : `Hello ${user.name},\n\nYour account verification status has been updated to '${status}'. Please contact support if you believe this is an error.`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject,
      text: message,
    });

    res.json({
      message: `User ${status === "verified" ? "verified" : "unverified"} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * 5. Delete a member (Admin only)
 */
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'Member not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;