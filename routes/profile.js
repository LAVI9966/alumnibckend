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
    console.log("Headers:", req.headers);
    console.log("Received Request:", req.body);
    console.log("File Details:", req.file); 

    if (!req.file) {
      console.error("Multer did not process the file. Check field name in Postman.");
      return res.status(400).json({ message: "No file uploaded" });
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


module.exports = router;

