import React, { useEffect, useState, useRef } from 'react';
import { useChatStore } from './store/useChatStore';
import { useAuthStore } from './store/useAuthStore';
import { Send, Paperclip, LogOut, MessageSquare, Menu, X } from 'lucide-react';
import AuthPage from './components/AuthPage';

export default function App() {
  const [text, setText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 1. Pull everything we need from the store
  const { 
    messages, sendMessage, connect, 
    onlineUsers, uploadFile, activeRoom, socket,
    selectedUser, setSelectedUser, setActiveRoom
  } = useChatStore();

  const { user, token, logout } = useAuthStore();

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // 2. Connect when authenticated
  useEffect(() => {
    if (token) {
      connect(token);
    }
  }, [token, connect]);

  // 3. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // If not logged in, show Auth Page
  if (!user) {
    return <AuthPage />;
  }

  // 4. Handle Text Messages
  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    sendMessage({
      roomId: activeRoom || "general",
      text: text,
      type: "text",
      receiverId: selectedUser?.id
    });
    setText("");
  };

  // 5. Handle File Uploads
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fileUrl = await uploadFile(file);
      if (fileUrl) {
        sendMessage({
          roomId: activeRoom || "general",
          text: "Sent an image",
          fileUrl: fileUrl,
          type: "image",
          receiverId: selectedUser?.id
        });
      } else {
        alert("Upload failed. Please check your Cloudinary configuration.");
      }
    } catch (error) {
      alert("An error occurred during upload.");
    } finally {
      e.target.value = ""; // Clear input
    }
  };

  const currentUserId = user.id;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-indigo-600">Chat App</h1>
            <div className="flex items-center gap-1">
              <button onClick={logout} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <LogOut size={18} />
              </button>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 md:hidden"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-slate-500 font-medium">{socket?.connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Channels</h2>
              <button 
                onClick={() => {
                  setActiveRoom('general');
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2 p-2 rounded-xl text-sm font-semibold transition-colors ${activeRoom === 'general' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">#</div>
                General Chat
              </button>
            </div>

            <div>
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Direct Messages</h2>
              <div className="space-y-2">
                {onlineUsers
                  .filter(u => typeof u === 'object' && u.id !== currentUserId)
                  .map((u) => (
                  <button 
                    key={u.id} 
                    onClick={() => {
                      setSelectedUser(u, currentUserId);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${
                      selectedUser?.id === u.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                      {u.username?.slice(0, 2).toUpperCase() || "???"}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">{u.username || "Unknown User"}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Online</span>
                    </div>
                  </button>
                ))}
                {onlineUsers.filter(u => u.id !== currentUserId).length === 0 && (
                  <p className="text-[10px] text-slate-400 italic px-2">No other users online</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Current User Info */}
        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
              {user?.username?.slice(0, 2).toUpperCase() || "ME"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold truncate max-w-[120px]">{user?.username || "Me"}</span>
              <span className="text-[10px] text-slate-500">My Account</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b bg-white flex items-center px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-lg text-slate-500 md:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
              {selectedUser ? <MessageSquare size={20} /> : <span className="font-bold">#</span>}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                {selectedUser ? `Chat with ${selectedUser.username || "User"}` : 'General Chat'}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {selectedUser ? 'Private Conversation' : 'Open to everyone'}
              </p>
            </div>
          </div>
        </header>

        {/* Messages List */}
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <div className="p-5 bg-white rounded-full shadow-sm border border-slate-100">
                <Send size={32} className="text-slate-300" />
              </div>
              <p className="font-medium">No messages yet. Say hi!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[70%]`}>
                    {!isMe && (
                      <span className="text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase tracking-tighter">
                        {msg.senderName || msg.senderId}
                      </span>
                    )}
                    <div className={`p-3 rounded-2xl shadow-sm ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}>
                      {msg.type === 'image' ? (
                        <img src={msg.fileUrl} alt="Sent" className="max-w-full rounded-lg mb-1" />
                      ) : (
                        <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                      )}
                      
                      <span className={`text-[9px] font-bold block mt-1 ${
                        isMe ? 'text-indigo-200 text-right' : 'text-slate-400'
                      }`}>
                        {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Field Area */}
        <div className="p-4 bg-white border-t">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSend} className="flex items-center gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all duration-200">
              <button 
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="p-2.5 text-slate-500 hover:bg-slate-200 hover:text-indigo-600 rounded-xl transition-all"
                title="Attach file"
              >
                <Paperclip size={20} />
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
              />

              <input 
                type="text" 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-slate-800 placeholder:text-slate-400 px-2 font-medium"
              />

              <button 
                type="submit"
                disabled={!text.trim()}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:grayscale transition-all shadow-indigo-200 shadow-lg disabled:shadow-none"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 