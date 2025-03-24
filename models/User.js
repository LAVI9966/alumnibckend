// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  collegeNo: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: Number, require: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "alumni", "admin"], default: "user" },
  profilePicture: { type: String },
  isVerified: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "verified"], default: "pending" },
  otp: { type: String },
  otpExpires: { type: Date },

  resetPasswordToken: { type: String }, 
  resetPasswordExpires: { type: Date }, 
});

// Hash the password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(this.password, salt);
    this.password = hash;
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);