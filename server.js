// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

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
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' },
});

const corsOptions = {
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
app.use('/api/stats', statsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use("/api/notifications", require("./routes/notifications"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  // Allow connection without token for public routes
  if (!token) {
    socket.userId = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    // Instead of throwing an error, just set userId to null
    socket.userId = null;
    next();
  }
});

// Socket.IO Real-Time Chat Setup
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Only allow authenticated users to join rooms and send messages
  if (socket.userId) {
    // Join a specific room for one-to-one chat
    socket.on('joinRoom', (data) => {
      const roomId = typeof data === 'object' && data.roomId ? data.roomId : data;
      if (typeof roomId !== 'string') {
        console.error(`Invalid roomId format received: ${JSON.stringify(data)}`);
        return;
      }
      socket.join(roomId);
      console.log(`User ${socket.userId} joined room: ${roomId}`);
    });

    // Join global chat room
    socket.on('joinGlobalRoom', () => {
      socket.join('global');
      console.log(`User ${socket.userId} joined global room`);
    });

    // Join user's personal room for notifications
    socket.on('joinUserRoom', (userId) => {
      if (userId === socket.userId) {
        socket.join(userId);
        console.log(`User ${socket.userId} joined their personal room`);
      }
    });

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(data.senderId) || !mongoose.Types.ObjectId.isValid(data.receiverId)) {
          console.error('Invalid sender or receiver ID format');
          return;
        }

        const senderObjectId = new mongoose.Types.ObjectId(data.senderId);
        const receiverObjectId = new mongoose.Types.ObjectId(data.receiverId);

        const Chat = require('./models/Chat');
        const newMessage = new Chat({
          senderId: senderObjectId,
          receiverId: receiverObjectId,
          message: data.message,
          isRead: false
        });
        const savedMessage = await newMessage.save();

        // Emit to the specific room
        io.to(data.roomId).emit('receiveMessage', savedMessage);

        // Emit notification to receiver's personal room
        io.to(data.receiverId.toString()).emit('newMessageNotification', {
          fromUserId: data.senderId,
          message: data.message
        });
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    // Handle sending global messages
    socket.on('sendGlobalMessage', async (data) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(data.senderId)) {
          console.error('Invalid sender ID format');
          return;
        }

        const senderObjectId = new mongoose.Types.ObjectId(data.senderId);
        const GlobalChat = require('./models/GlobalChat');
        const newMessage = new GlobalChat({
          senderId: senderObjectId,
          message: data.message,
        });
        const savedMessage = await newMessage.save();

        // Emit to global room
        io.to('global').emit('receiveGlobalMessage', savedMessage);

        // Emit notification to all users except sender
        socket.broadcast.to('global').emit('newGlobalMessage', {
          message: data.message,
          senderId: data.senderId
        });
      } catch (error) {
        console.error('Error saving global message:', error);
      }
    });

    // Handle marking messages as read
    socket.on('markAsRead', async (data) => {
      try {
        const { userId } = data;
        if (!userId) return;

        const Chat = require('./models/Chat');
        await Chat.updateMany(
          {
            senderId: userId,
            receiverId: socket.userId,
            isRead: false
          },
          {
            $set: { isRead: true }
          }
        );

        const unreadCounts = await Chat.aggregate([
          {
            $match: {
              receiverId: mongoose.Types.ObjectId(socket.userId),
              isRead: false
            }
          },
          {
            $group: {
              _id: '$senderId',
              count: { $sum: 1 }
            }
          }
        ]);

        const unreadCountsObj = unreadCounts.reduce((acc, curr) => {
          acc[curr._id.toString()] = curr.count;
          return acc;
        }, {});

        io.to(socket.userId).emit('unreadCountsUpdated', unreadCountsObj);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle marking global chat as read
    socket.on('markGlobalAsRead', async () => {
      try {
        const User = require('./models/User');
        const user = await User.findById(socket.userId);
        if (user) {
          user.lastGlobalChatRead = new Date();
          await user.save();
        }
      } catch (error) {
        console.error('Error marking global chat as read:', error);
      }
    });
  }

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
