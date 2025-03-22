// routes/members.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const admin = require('../middleware/admin');

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
    const members = await User.find({}, { password: 0 });
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
    console.log(status,"gaurav")
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!["pending", "verified"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Update the verification status
    user.status = status;
    await user.save();

    res.json({ message: "User verified successfully", user });
  } catch (error) {
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