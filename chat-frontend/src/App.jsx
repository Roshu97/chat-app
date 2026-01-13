import React, { useEffect, useState, useRef } from 'react';
import { useChatStore } from './store/useChatStore';
import { Send, Paperclip } from 'lucide-react';

export default function App() {
  const [text, setText] = useState("");
  
  // 1. Pull everything we need from the store
  const { 
    messages, sendMessage, connect, 
    onlineUsers, uploadFile, activeRoom, socket
  } = useChatStore();

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // 2. Simulate Auth & Connect
  useEffect(() => {
    // Use a stable ID for the session to avoid duplicates in dev (Strict Mode)
    const storedId = sessionStorage.getItem("chat_user_id");
    const storedName = sessionStorage.getItem("chat_user_name");
    
    const userId = storedId || "user_" + Math.floor(Math.random() * 1000);
    const username = storedName || "Developer_" + userId.slice(-3);

    if (!storedId) {
      sessionStorage.setItem("chat_user_id", userId);
      sessionStorage.setItem("chat_user_name", username);
    }

    connect(userId, username);

    return () => {
      // Optional: disconnect on unmount if you want strictly one connection per component life
      // disconnect(); 
    };
  }, [connect]);

  // 3. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // 4. Handle Text Messages
  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    sendMessage({
      roomId: activeRoom || "general",
      text: text,
      type: "text",
    });
    setText("");
  };

  // 5. Handle File Uploads
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileUrl = await uploadFile(file);
    if (fileUrl) {
      sendMessage({
        roomId: activeRoom || "general",
        text: "Sent an image",
        fileUrl: fileUrl,
        type: "image",
      });
    }
  };

  const currentUserId = socket?.io?.opts?.query?.userId;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col hidden md:flex">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-indigo-600">Chat App</h1>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-slate-500 font-medium">{socket?.connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Online Users ({onlineUsers.length})</h2>
          <div className="space-y-2">
            {onlineUsers.map((user) => (
              <div key={user} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-default transition-colors">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                  {user.slice(-2).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-slate-700">{user}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-16 bg-white border-b flex items-center px-6 justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-indigo-600 font-bold text-xl">#</span>
            <h2 className="font-bold text-slate-800">{activeRoom}</h2>
          </div>
        </div>

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
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 placeholder:text-slate-400 px-2 font-medium"
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