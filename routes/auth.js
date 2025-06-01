// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const nodemailer = require('nodemailer');
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * Generate a 4-digit OTP.
 * (Adjust to 6 digits if desired, e.g. 100000 + Math.random() * 900000)
 */
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
};

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

/**
 * 1. Register
 *    - Create user with isVerified=false.
 *    - Generate OTP, store in user, send via email.
 *    - Return a token so the client can pass it to the verify-otp route.
 */
router.post('/register', async (req, res) => {
  const { collegeNo, name, email, mobileNumber, countryCode, password, role, profession, location } = req.body;
  try {
    // Check if user already exists by email
    let userByEmail = await User.findOne({ email: email });
    if (userByEmail) {
      // If user exists but is not verified, allow re-registration
      if (!userByEmail.isVerified) {
        // Generate new OTP & set expiry
        const otp = generateOTP();
        const otpExpiry = Date.now() + 5 * 60 * 1000;

        // Update existing user with new details
        userByEmail.otp = otp;
        userByEmail.otpExpires = otpExpiry;
        userByEmail.name = name;
        userByEmail.collegeNo = collegeNo;
        userByEmail.mobileNumber = mobileNumber;
        userByEmail.countryCode = countryCode;
        userByEmail.password = password;
        userByEmail.role = role;
        userByEmail.profession = profession || userByEmail.profession;
        userByEmail.location = location || userByEmail.location;
        await userByEmail.save();

        // Send new OTP via email
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Your New OTP Code',
          text: `Your new OTP code is ${otp}. It is valid for 5 minutes.`,
        });

        // Sign a JWT with user ID and role
        const payload = { id: userByEmail._id, role: userByEmail.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

        return res.status(200).json({
          message: 'New OTP sent to your email. Please verify.',
          token,
          user: {
            id: userByEmail._id,
            name: userByEmail.name,
            email: userByEmail.email,
            role: userByEmail.role,
          },
        });
      }
      return res
        .status(400)
        .json({ message: 'User with this email already exists.' });
    }

    // Check if user already exists by mobile number and country code
    let userByMobile = await User.findOne({
      countryCode: countryCode,
      mobileNumber: mobileNumber
    });

    if (userByMobile) {
      return res
        .status(400)
        .json({ message: 'User with this mobile number already exists.' });
    }

    // Generate OTP & set expiry (e.g., 5 minutes)
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    // Create new user (not verified yet)
    let user = new User({
      collegeNo,
      name,
      email,
      countryCode,
      mobileNumber,
      password,
      role,
      profession: profession || undefined,
      location: location || undefined,
      isVerified: false,
      otp,
      otpExpires: otpExpiry,
    });
    await user.save();

    // Send OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
    });

    // Sign a JWT with user ID and role, valid for 1 hour
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

    // Return the token so client can use it for verify-otp
    res.status(201).json({
      message: 'OTP sent to your email. Please verify.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new route for resending OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // If user is already verified, no need to resend OTP
    if (user.isVerified) {
      return res.status(400).json({ message: 'User is already verified.' });
    }

    // Generate new OTP & set expiry
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    // Update user with new OTP
    user.otp = otp;
    user.otpExpires = otpExpiry;
    await user.save();

    // Send new OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your New OTP Code',
      text: `Your new OTP code is ${otp}. It is valid for 5 minutes.`,
    });

    // Sign a new JWT
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

    return res.status(200).json({
      message: 'New OTP sent to your email.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    return res.status(500).json({ message: 'Server error while resending OTP' });
  }
});

/**
 * 2. Verify OTP
 *    - Client only sends { otp } in the body.
 *    - Client must include the token from /register in the Authorization header: "Bearer <token>".
 *    - We decode the token to find which user is verifying.
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;

    // The client must send the token in headers: Authorization: Bearer <token>
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Decode token to get user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    // Check OTP match
    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    // Check OTP expiration
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired.' });
    }

    // Mark user as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Fetch all admin users
    const adminUsers = await User.find({ role: 'admin' });

    // Extract email addresses of admins
    const adminEmails = adminUsers.map(admin => admin.email).filter(Boolean);

    // Send email to all admins
    if (adminEmails.length > 0) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: adminEmails, // Sends to all admin emails
        subject: 'New User Registration Awaiting Verification',
        text: `A new user has registered and is awaiting admin verification.`
      });
    }

    // //send admin mail new user is registered
    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: process.env.ADMIN_EMAIL, // ✅ Admin email address from env
    //   subject: 'New User Registration Awaiting Verification',
    //   text: `A new user has registered and is awaiting admin verification.`
    // });


    return res.status(200).json({ message: 'OTP verified. We will notify you by email once your account is approved by the admins.' });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({ message: 'Server error while verifying OTP' });
  }
});

/**
 * 3. Login
 *    - Requires user to be verified.
 *    - Compares hashed password, issues JWT on success.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email is not registered. Please register first.' });
    }

    // Check if verified
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please complete OTP verification first. You can request a new OTP by trying to register again with the same email.',
        isUnverified: true,
        email: user.email
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Generate JWT
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to check access token
router.get('/check-token', auth, async (req, res) => {
  try {
    // Get user details to check verification status
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Return the same structure as before, but add verification status
    res.json({
      message: 'Token is valid',
      user: {
        ...req.user,
        isVerified: user.isVerified,
        status: user.status // Include status for admin verification
      }
    });
  } catch (error) {
    console.error('Token Verification Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    // Check if a user with the provided email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email is not registered. Please register first." });
    }

    // Generate a reset token and set its expiry (1 hour from now)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour in milliseconds

    // Save the token and its expiry on the user's document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Construct a reset link (adjust FRONTEND_URL in your .env as needed)
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"
      }/reset-password?token=${resetToken}`;

    // Send reset instructions via email using nodemailer
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click on the link below to reset your password (valid for 1 hour):
      ${resetLink}
      If you did not request this, please ignore this email.`,
    });
    res.status(200).json({ message: "Password reset email sent." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error." });
  }
});


router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure token is not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // Set the new password (the pre-save hook will handle hashing)
    user.password = newPassword;

    // Clear the reset token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res
      .status(200)
      .json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;