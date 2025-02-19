// routes/chat.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

// Send message (HTTP POST)
router.post('/send', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    const newMessage = new Chat({ senderId, receiverId, message });
    const savedMessage = await newMessage.save();
    return res.status(200).json({ success: true, data: savedMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get all messages between two users
router.get('/messages/:user1Id/:user2Id', async (req, res) => {
  try {
    const { user1Id, user2Id } = req.params;
    const messages = await Chat.find({
      $or: [
        { senderId: user1Id, receiverId: user2Id },
        { senderId: user2Id, receiverId: user1Id },
      ],
    }).sort({ timestamp: 1 });
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;