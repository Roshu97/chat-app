import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export const useChatStore = create((set, get) => ({
  // --- STATE ---
  socket: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {}, // { userId: username }
  activeRoom: 'general',
  isConnecting: false,

  // --- ACTIONS ---
  
  // Set Active Room & Handle Transitions
  setActiveRoom: (roomId) => {
    const { socket, activeRoom } = get();
    if (socket) {
      socket.emit('leave_room', activeRoom); 
      socket.emit('join_room', roomId);      
      set({ activeRoom: roomId, messages: [] }); // Clear UI while history loads
    }
  },

  // Main Connection Logic
  connect: (userId, username) => {
    if (get().socket?.connected) return;

    set({ isConnecting: true });
    
    const socket = io(SOCKET_URL, {
      query: { userId, username },
    });

    socket.on('connect', () => {
      set({ socket, isConnecting: false });
      console.log('Connected to WebSocket');
      // Join default room on connection
      socket.emit('join_room', get().activeRoom);
    });

    // Listeners
    socket.on('get_online_users', (users) => set({ onlineUsers: users }));
    
    socket.on('load_history', (history) => set({ messages: history }));

    socket.on('receive_message', (newMessage) => {
      set((state) => ({ messages: [...state.messages, newMessage] }));
    });

    // Typing Indicators
    socket.on('user_typing', ({ userId, username }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [userId]: username }
      }));
    });

    socket.on('user_stopped_typing', (userId) => {
      set((state) => {
        const newTyping = { ...state.typingUsers };
        delete newTyping[userId];
        return { typingUsers: newTyping };
      });
    });

    socket.on('disconnect', () => set({ socket: null }));

    set({ socket });
  },

  sendMessage: (messageData) => {
    const { socket } = get();
    if (socket) socket.emit('send_message', messageData);
  },

  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "your_preset_name"); 

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/your_cloud_name/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return data.secure_url;
    } catch (error) {
      console.error("Upload failed", error);
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