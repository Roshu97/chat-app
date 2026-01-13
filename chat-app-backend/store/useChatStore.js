import { create } from 'zustand';
import { io } from 'socket.io-client';

export const useChatStore = create((set, get) => ({
  socket: null,
  messages: [],
  onlineUsers: [],

  connect: (token) => {
    const socket = io('https://chat-app-cif6.onrender.com', {
      auth: { token }
    });

    socket.on('receive_message', (msg) => {
      set((state) => ({ messages: [...state.messages, msg] }));
    });

    set({ socket });
  },

  sendMessage: (roomId, content, type = 'text') => {
    const { socket } = get();
    if (socket) {
      socket.emit('send_message', { roomId, content, type });
    }
  }
}));