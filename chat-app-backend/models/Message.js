const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  receiverId: { type: String }, // Optional: only for private messages
  senderName: String,
  text: { type: String, required: true },
  type: { type: String, default: 'text' }, // 'text', 'image', or 'file'
  fileUrl: String,
}, { timestamps: true });

// Indexing roomId helps fetch history faster as the DB grows
module.exports = mongoose.model('Message', messageSchema);