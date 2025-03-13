// server.js
const express = require('express');
const http = require('http');         
const socketIO = require('socket.io'); 
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const memberRoutes = require('./routes/members');
const profileRoutes = require('./routes/profile');
const contactRoutes = require('./routes/contact');
const aboutRoutes = require('./routes/about');
const chatRoutes = require('./routes/chat');
const statsRoutes = require("./routes/stats");
const postsRoutes = require("./routes/posts");

const app = express();
const server = http.createServer(app);  // Create an HTTP server from Express
const io = socketIO(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error(err));

// Define your existing routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/chat', chatRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/posts", postsRoutes);

// --- Socket.IO Real-Time Chat Setup ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 1. Join a specific room for one-to-one chat
  socket.on('joinRoom', (data) => {
    console.log(`Received joinRoom event from ${socket.id} with data:`, data);
  
    // Check if `data` is an object and extract `roomId`
    const roomId = typeof data === 'object' && data.roomId ? data.roomId : data;
  
    // Ensure roomId is a string
    if (typeof roomId !== 'string') {
      console.error(`Invalid roomId format received: ${JSON.stringify(data)}`);
      return;
    }
  
    socket.join(roomId);
    console.log(`User with socket ID ${socket.id} joined room: ${roomId}`);
  });

  // 2. Handle sending messages
  socket.on('sendMessage', async (data) => {
    // data = { roomId, senderId, receiverId, message }
    try {

      console.log(`Message received from ${data.senderId} to ${data.receiverId}: ${data.message}`);

      // Validate if senderId and receiverId are valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(data.senderId) || !mongoose.Types.ObjectId.isValid(data.receiverId)) {
        console.error('Invalid sender or receiver ID format');
        return;
      }

      // Convert senderId & receiverId to ObjectId
    const senderObjectId = new mongoose.Types.ObjectId(data.senderId);
    const receiverObjectId = new mongoose.Types.ObjectId(data.receiverId);
      // Save to MongoDB
      const Chat = require('./models/Chat'); // import Chat model inside event
      const newMessage = new Chat({
        senderId: senderObjectId,
        receiverId: receiverObjectId,
        message: data.message,
      });
      const savedMessage = await newMessage.save();

      // Broadcast the message to everyone in the room
      io.to(data.roomId).emit('receiveMessage', savedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});