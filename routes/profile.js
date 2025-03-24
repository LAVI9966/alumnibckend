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
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });


// POST /api/profile/upload-profile-picture
router.post('/upload-profile-picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {

    if (!req.file) {
      console.error("Multer did not process the file. Check field name in Postman.");
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Save file path
    user.profilePicture = req.file.filename;
    await user.save();

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//get all profiles GET /api/profile/
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

router.put("/update", auth, async (req, res) => {
  try {
    const userId = req.user.id; // from decoded token
    const { name, mobileNumber } = req.body;

    // Find the user
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;

    // ... add other fields as needed ...

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
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

// DELETE /api/profile/delete
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

