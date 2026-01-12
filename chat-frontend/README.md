💬 Real-Time Nexus: Advanced Chat Engine
A production-ready, full-stack real-time messaging platform built with React, Node.js, and Socket.io. This project demonstrates advanced engineering concepts like event-driven architecture, binary data handling via cloud providers, and high-frequency state synchronization.

🚀 Key Features
Live Bi-directional Messaging: Sub-100ms latency using WebSocket (Socket.io).

Dynamic Group Rooms: Isolated communication channels with automated room joining/leaving logic.

Binary File Sharing: High-performance image sharing via Cloudinary CDN integration (offloading socket bandwidth).

Global Presence System: Real-time online/offline status tracking with server-side Maps.

UX Micro-interactions: Debounced typing indicators and auto-scrolling message history.

Data Persistence: Full message history retrieval powered by MongoDB.

🛠️ Technical Stack
Frontend: React (Vite), Tailwind CSS, Zustand (State Management), Lucide Icons.

Backend: Node.js, Express, Socket.io.

Database: MongoDB (via Mongoose).

Storage: Cloudinary API.

🏗️ Architectural Decisions

1. State Management: Zustand vs. Redux
I chose Zustand for state management to handle high-frequency socket updates. Its "outside-of-React" execution allowed for a cleaner separation of socket listeners from the UI components, preventing unnecessary re-renders.

2. High-Frequency Event Optimization (Typing Indicators)
To prevent server-side bottlenecks, I implemented a Debouncing strategy for typing indicators. Instead of emitting an event on every keystroke, the client waits for a 2-second pause in activity before notifying the room that the user has stopped typing.

3. Scalable File Handling
Rather than streaming raw binary data through WebSockets—which can choke the main thread—I implemented a Direct-to-Cloud upload pattern. Files are sent to Cloudinary, and only the lightweight Secure URL is broadcasted, ensuring the socket connection remains responsive.

4. Database IndexingThe MongoDB Message schema uses an index on the roomId field, ensuring that fetching chat history remains $O(log n)$ even as the database grows to thousands of messages.