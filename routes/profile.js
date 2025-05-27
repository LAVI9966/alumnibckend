const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Make sure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a clean filename without spaces and special characters
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    const fileExt = path.extname(file.originalname);
    cb(null, uniqueSuffix + fileExt);
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

    // Store only the filename, not the full path
    const filename = req.file.filename;
    user.profilePicture = filename;
    await user.save();

    console.log('Profile picture uploaded:', filename);

    // Return detailed information about the file
    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture,
      filename: filename,
      path: req.file.path,
      fullUrl: `${process.env.NEXT_PUBLIC_URL}/uploads/${filename}`
    });
  } catch (err) {
    console.error("Upload Error:", err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size should be less than 5MB' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// In profile routes - GET profile
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password -otp -otpExpires');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Include new fields in response
    return res.status(200).json({
      user: {
        ...user.toObject(),
        profession: user.profession || '',
        location: user.location || ''
      }
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// In profile routes - UPDATE profile
router.put("/update", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, mobileNumber, countryCode, profession, location } = req.body;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
    if (countryCode !== undefined) user.countryCode = countryCode;
    if (profession !== undefined) user.profession = profession;
    if (location !== undefined) user.location = location;

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
        profession: user.profession,
        location: user.location,
      },
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
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