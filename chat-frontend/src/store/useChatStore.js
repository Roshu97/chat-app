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
    const { socket, isConnecting } = get();
    if (socket?.connected || isConnecting) return;

    set({ isConnecting: true });
    
    const newSocket = io(SOCKET_URL, {
      query: { userId, username },
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