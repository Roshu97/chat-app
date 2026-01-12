const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" }
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Could not connect to MongoDB", err));

const Message = require('./models/Message');
const onlineUsers = new Map(); // userId -> { socketId, username }

// Middleware: Authenticate Socket Connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const { userId, username } = socket.handshake.query;

  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = user;
      return next();
    } catch (err) {
      console.warn("JWT Verification failed, falling back to query params");
    }
  }

  // Fallback for development: use query params if no token
  if (userId && username) {
    socket.user = { id: userId, username: username };
    return next();
  }

  next(new Error("Authentication error"));
});

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`User Connected: ${user.username} (${user.id})`);

  onlineUsers.set(user.id, { socketId: socket.id, username: user.username });
  io.emit('get_online_users', Array.from(onlineUsers.keys()));

  // 1. Join a specific Room
  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    console.log(`User ${user.id} joined room ${roomId}`);

    // Fetch history
    try {
      const history = await Message.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(50);
      socket.emit('load_history', history.reverse());
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  });

  // 2. Real-time Messaging
  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        roomId: data.roomId,
        senderId: user.id,
        senderName: user.username,
        text: data.text,
        type: data.type || 'text',
        fileUrl: data.fileUrl
      });
      
      const savedMessage = await newMessage.save();
      io.to(data.roomId).emit('receive_message', savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  // 3. Typing Indicators
  socket.on('typing_start', (roomId) => {
    socket.to(roomId).emit('user_typing', { 
      userId: user.id, 
      username: user.username 
    });
  });

  socket.on('typing_stop', (roomId) => {
    socket.to(roomId).emit('user_stopped_typing', user.id);
  });

  // 4. Presence Logic
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${user.username}`);
    onlineUsers.delete(user.id);
    io.emit('get_online_users', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));