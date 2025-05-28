// routes/chat.js
const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const GlobalChat = require('../models/GlobalChat');
const auth = require('../middleware/auth');
const User = require('../models/User');
const adminVerify = require('../middleware/adminVerify');

// Send message (HTTP POST) - only for authenticated & admin-verified users
router.post('/send', auth, adminVerify, async (req, res) => {
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

// Get all messages between two users (only for authenticated & admin-verified users)
router.get('/messages/:user1Id/:user2Id', auth, adminVerify, async (req, res) => {
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

// Get global chat messages
router.get('/global-messages', auth, adminVerify, async (req, res) => {
  try {
    const messages = await GlobalChat.find()
      .sort({ timestamp: -1 })
      .limit(100); // Limit to last 100 messages for performance

    // Populate sender information
    const populatedMessages = await Promise.all(
      messages.map(async (message) => {
        const sender = await User.findById(message.senderId).select('name profilePicture');
        return {
          ...message.toObject(),
          senderName: sender ? sender.name : 'Unknown User',
          senderProfilePicture: sender ? sender.profilePicture : null
        };
      })
    );

    return res.status(200).json({ success: true, data: populatedMessages });
  } catch (error) {
    console.error('Error fetching global messages:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent chat list with user details, last message and timestamp 
router.get('/recent-chats', auth, adminVerify, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all messages where the user is sender or receiver, sorted by most recent first
    const chats = await Chat.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    }).sort({ timestamp: -1 });

    // Create a map to store the most recent message for each distinct chat partner
    const recentChats = new Map();
    for (const chat of chats) {
      const otherUserId = chat.senderId.toString() === userId ? chat.receiverId.toString() : chat.senderId.toString();
      if (!recentChats.has(otherUserId)) {
        recentChats.set(otherUserId, {
          lastMessage: chat.message,
          timestamp: chat.timestamp
        });
      }
    }

    const recentUserIds = Array.from(recentChats.keys());

    // Retrieve user details for the recent chat partners
    const users = await User.find({ _id: { $in: recentUserIds } }, 'name email profilePicture');

    // Build an array combining user details with their last chat info
    const recentConversations = users.map(user => {
      const chatData = recentChats.get(user._id.toString());
      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        lastMessage: chatData.lastMessage,
        timestamp: chatData.timestamp
      };
    });

    // Sort conversations by timestamp descending
    recentConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({ success: true, recentChats: recentConversations });
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;