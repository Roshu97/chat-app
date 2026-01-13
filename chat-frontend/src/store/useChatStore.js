import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const useChatStore = create((set, get) => ({
  // --- STATE ---
  socket: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {}, // { userId: username }
  activeRoom: 'general',
  selectedUser: null, // { id, username }
  isConnecting: false,

  // --- ACTIONS ---
  
  setSelectedUser: (user, currentUserId) => {
    const { socket, activeRoom } = get();
    if (!user) {
      if (activeRoom !== 'general') {
        get().setActiveRoom('general');
      }
      set({ selectedUser: null });
      return;
    }

    if (!currentUserId) return;

    // Generate a unique room ID for the private chat
    const roomId = [currentUserId, user.id].sort().join('_');
    const privateRoomId = `private_${roomId}`;

    if (socket) {
      socket.emit('leave_room', activeRoom);
      socket.emit('join_room', privateRoomId);
      set({ activeRoom: privateRoomId, selectedUser: user, messages: [] });
    }
  },

  // Set Active Room & Handle Transitions
  setActiveRoom: (roomId) => {
    const { socket, activeRoom } = get();
    if (socket) {
      socket.emit('leave_room', activeRoom); 
      socket.emit('join_room', roomId);      
      set({ activeRoom: roomId, selectedUser: null, messages: [] }); // Clear UI while history loads
    }
  },

  // Main Connection Logic
  connect: (token) => {
    const { socket, isConnecting } = get();
    if (socket?.connected || isConnecting || !token) return;

    set({ isConnecting: true });
    
    const newSocket = io(SOCKET_URL, {
      auth: { token },
    });

    newSocket.on('connect', () => {
      set({ socket: newSocket, isConnecting: false });
      console.log('Connected to WebSocket');
      // Join default room on connection
      newSocket.emit('join_room', get().activeRoom);
    });

    // Listeners
    newSocket.on('get_online_users', (users) => set({ onlineUsers: users }));
    
    newSocket.on('load_history', (history) => set({ messages: history }));

    newSocket.on('receive_message', (newMessage) => {
      // Prevent duplicate messages if multiple sockets somehow exist
      set((state) => {
        const isDuplicate = state.messages.some(m => m._id === newMessage._id);
        if (isDuplicate) return state;
        return { messages: [...state.messages, newMessage] };
      });
    });

    newSocket.on('private_message_notification', ({ senderId, senderName, message }) => {
      // Logic for handling private message when not in the room
      // For now, we could just console log or add a 'unread' flag to the user in onlineUsers
      console.log(`New private message from ${senderName}: ${message.text}`);
    });

    // Typing Indicators
    newSocket.on('user_typing', ({ userId, username }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [userId]: username }
      }));
    });

    newSocket.on('user_stopped_typing', (userId) => {
      set((state) => {
        const newTyping = { ...state.typingUsers };
        delete newTyping[userId];
        return { typingUsers: newTyping };
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      set({ socket: null, isConnecting: false });
    });

    set({ socket: newSocket });
  },

  sendMessage: (messageData) => {
    const { socket } = get();
    if (socket) socket.emit('send_message', messageData);
  },

  uploadFile: async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.error("Cloudinary configuration missing. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.");
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset); 

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Upload failed");
      }

      const data = await res.json();
      return data.secure_url;
    } catch (error) {
      console.error("Upload failed:", error.message);
      return null;
    }
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  }
}));