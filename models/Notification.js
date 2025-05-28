const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // recipient
    type: { type: String, enum: ['like', 'comment', 'reply', 'event'], required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who triggered (optional for event)
    message: { type: String },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
