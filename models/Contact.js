// models/Contact.js
const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  department: { type: String, required: true }, // New field
}, {
  timestamps: true
});

module.exports = mongoose.model('Contact', ContactSchema);