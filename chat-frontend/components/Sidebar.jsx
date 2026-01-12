const { onlineUsers, setActiveRoom, activeRoom } = useChatStore();

const rooms = [
  { id: 'general', name: 'General Chat' },
  { id: 'dev-team', name: 'Dev Team' },
  { id: 'marketing', name: 'Marketing' }
];

return (
  <div className="w-80 bg-white border-r">
    <div className="p-4">
      <h2 className="font-bold text-xl mb-4">Groups</h2>
      {rooms.map(room => (
        <div 
          key={room.id}
          onClick={() => setActiveRoom(room.id)}
          className={`p-3 mb-2 rounded-lg cursor-pointer transition ${
            activeRoom === room.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
          }`}
        >
          # {room.name}
        </div>
      ))}
      
      <h2 className="font-bold text-xl mt-8 mb-4">Online Now ({onlineUsers.length})</h2>
      {onlineUsers.map(uId => (
        <div key={uId} className="flex items-center gap-2 p-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm text-gray-600">{uId}</span>
        </div>
      ))}
    </div>
  </div>
);