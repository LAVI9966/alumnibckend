const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const User = require('../models/User');
const path = require('path');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Use a unique filename with original extension
    const fileExt = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`);
  },
});

// File filter to accept only image files
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Set up multer upload with size limits
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter,
});

// POST /api/profile/upload-profile-picture
router.post('/upload-profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded or file type not supported" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Save file path
    user.profilePicture = req.file.path;
    await user.save();

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size should be less than 5MB' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/profile/ - Get user profile
router.get('/', auth, async (req, res) => {
  try {
    // Use req.user.id from the decoded token (auth middleware)
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password -otp -otpExpires');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// PUT /api/profile/update - Update user profile
router.put("/update", auth, async (req, res) => {
  try {
    const userId = req.user.id; // from decoded token
    const { name, mobileNumber, countryCode } = req.body;

    // Find the user
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
    if (countryCode !== undefined) user.countryCode = countryCode;

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        countryCode: user.countryCode,
        profilePicture: user.profilePicture,
      },
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});

// DELETE /api/profile/delete - Delete user profile
router.delete('/delete', auth, async (req, res) => {
  try {
    const userId = req.user.id; // from the decoded token
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Delete Profile Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;