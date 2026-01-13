const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Use CORS middleware for regular HTTP routes
const cors = require('cors');

const allowedOrigins = [
  "https://chat-app-1-44b4.onrender.com",
  "https://chat-app-1-one-flame.vercel.app",
  "https://chat-app-fullstack.onrender.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000"
];

const corsOptions = {
  origin: true, // Reflect request origin (allows credentials)
  credentials: true,
  optionsSuccessStatus: 200
};

// 1. Manual CORS handling to be absolutely sure
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // If the origin is in our allowed list (or if we just want to reflect it for local dev)
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Log all requests to help debug
app.use((req, res, next) => {
  // Normalize double slashes in URL
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use(express.json()); // Body parser after CORS

// Catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error("JSON Parsing Error:", err);
    return res.status(400).json({ message: "Invalid JSON" });
  }
  next();
});

const User = require('./models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log("Registration request body:", req.body);
    const { username, email, password } = req.body;
    console.log("Registration attempt:", { username, email });
    
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exists" });
    }

    user = new User({ username, email, password });
    await user.save();
    console.log("User saved successfully:", user._id);

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // In a real app, you'd send an email here. For now, we'll just return the token
    // to simplify testing since we don't have SMTP credentials.
    res.json({ message: "Reset token generated", resetToken: token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/api/test-db', async (req, res) => {
  try {
    const testUser = new User({ username: `test_${Date.now()}`, email: `test_${Date.now()}@test.com`, password: 'password' });
    await testUser.save();
    await User.deleteOne({ _id: testUser._id });
    res.json({ message: "Database write/delete successful" });
  } catch (error) {
    console.error("DB Test Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Chat Backend is running...');
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// -----------------------------------------------------------------------------
// SERVE FRONTEND (FOR UNIFIED DEPLOYMENT)
// -----------------------------------------------------------------------------
const frontendPath = path.join(__dirname, '../chat-frontend/dist');
app.use(express.static(frontendPath));

// For any request that doesn't match an API route, serve index.html
app.get('(.*)', (req, res, next) => {
  // If it starts with /api, it's a missed API route, so let it go to 404
  if (req.url.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Catch-all for undefined routes
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ message: "Something went wrong on the server", error: err.message });
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error("Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
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

  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  }

  next(new Error("Authentication error: Token missing"));
});

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`User Connected: ${user.username} (${user.id})`);

  onlineUsers.set(user.id, { socketId: socket.id, username: user.username });
  io.emit('get_online_users', Array.from(onlineUsers.entries()).map(([id, data]) => ({
    id,
    username: data.username
  })));

  // Each user joins their own personal room for private notifications
  socket.join(user.id);

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

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${user.id} left room ${roomId}`);
  });

  // 2. Real-time Messaging
  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        roomId: data.roomId,
        senderId: user.id,
        senderName: user.username,
        receiverId: data.receiverId, // For private messages
        text: data.text,
        type: data.type || 'text',
        fileUrl: data.fileUrl
      });
      
      const savedMessage = await newMessage.save();
      
      // Emit to the room
      io.to(data.roomId).emit('receive_message', savedMessage);

      // If it's a private message and the receiver isn't in the room, 
      // we can also emit to their personal room
      if (data.receiverId && data.roomId !== 'general') {
        io.to(data.receiverId).emit('private_message_notification', {
          senderId: user.id,
          senderName: user.username,
          message: savedMessage
        });
      }
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
    io.emit('get_online_users', Array.from(onlineUsers.entries()).map(([id, data]) => ({
      id,
      username: data.username
    })));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));