"use client";
import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Send, LogIn, LogOut, Users, MessageSquare, Hash, Plus, ChevronRight } from "lucide-react";

type Message = { user: string; message: string; timestamp: number };
type ActiveUser = { id: string; isSelf?: boolean };
type RoomInfo = { name: string; userCount: number };

export default function Chat() {
  const [roomInput, setRoomInput] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [roomList, setRoomList] = useState<RoomInfo[]>([]);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const lastMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL!);

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsLoadingRooms(false);
    });

    socket.on("message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("activeUsers", (users: ActiveUser[]) => {
      setActiveUsers(users);
    });

    socket.on("roomList", (rooms: RoomInfo[]) => {
      setRoomList(rooms);
    });

    return () => {
      socket.off("connect");
      socket.off("message");
      socket.off("activeUsers");
      socket.off("roomList");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const joinRoom = (room: string) => {
    if (room.trim() && socketRef.current) {
      socketRef.current.emit("joinRoom", room.trim());
      setJoinedRoom(room.trim());
      setMessages([]);
      setActiveUsers([]);
      setRoomInput("");
      setShowRoomForm(false);
    }
  };

  const leaveRoom = () => {
    if (joinedRoom && socketRef.current) {
      socketRef.current.emit("leaveRoom", joinedRoom);
      setJoinedRoom("");
      setMessages([]);
      setActiveUsers([]);
    }
  };

  const sendMessage = () => {
    if (message.trim() && joinedRoom && socketRef.current) {
      socketRef.current.emit("chatMessage", { room: joinedRoom, message });
      setMessage("");
    }
  };

  const formatTime = (ts: number): string =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (joinedRoom) {
        sendMessage();
      } else if (roomInput.trim()) {
        joinRoom(roomInput);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <MessageSquare className="text-indigo-600" size={20} />
          Chat Rooms
        </h2>

        {!joinedRoom ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Available Rooms</h3>
              <button
                onClick={() => setShowRoomForm(!showRoomForm)}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <Plus size={16} /> {showRoomForm ? 'Cancel' : 'New Room'}
              </button>
            </div>

            {showRoomForm && (
              <div className="mb-4">
                <div className="relative mb-2">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter room name"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => joinRoom(roomInput)}
                  disabled={!roomInput.trim()}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  Create & Join
                </button>
              </div>
            )}

            {isLoadingRooms ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : roomList.length > 0 ? (
              <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                {roomList.map((room) => (
                  <li
                    key={room.name}
                    onClick={() => joinRoom(room.name)}
                    className="cursor-pointer px-4 py-3 rounded-lg hover:bg-indigo-50 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="text-indigo-400 group-hover:text-indigo-600" size={16} />
                      <span className="font-medium">{room.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{room.userCount} users</span>
                      <ChevronRight className="text-gray-400 group-hover:text-indigo-600" size={16} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No rooms available</p>
                <p className="text-sm mt-2">Create the first room!</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Hash className="text-indigo-600" size={18} />
                {joinedRoom}
              </h3>
              <button
                onClick={leaveRoom}
                className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium text-sm"
              >
                <LogOut size={16} /> Leave
              </button>
            </div>

            <div className="flex-grow overflow-y-auto">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="text-indigo-600" size={18} /> Active Users
              </h4>
              {activeUsers.length === 0 ? (
                <p className="text-sm italic text-gray-500">No users online</p>
              ) : (
                <ul className="space-y-2">
                  {activeUsers.map((user) => (
                    <li
                      key={user.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${user.isSelf ? "bg-indigo-50 text-indigo-700" : "bg-gray-50"
                        }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${user.isSelf ? "bg-indigo-500" : "bg-gray-400"
                          }`}
                      ></div>
                      {user.isSelf ? "You" : user.id}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-col flex-grow">
        {joinedRoom ? (
          <>
            <div className="flex-grow overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                    <MessageSquare size={48} className="mb-4" />
                    <p className="text-lg">No messages yet</p>
                    <p className="text-sm">Be the first to send a message!</p>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.user === socketRef.current?.id ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-3 ${msg.user === socketRef.current?.id
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-white border border-gray-200 rounded-bl-none"
                          }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span
                            className={`text-xs font-medium ${msg.user === socketRef.current?.id ? "text-indigo-100" : "text-gray-500"
                              }`}
                          >
                            {msg.user === socketRef.current?.id ? "You" : msg.user}
                          </span>
                          <span
                            className={`text-xs ${msg.user === socketRef.current?.id ? "text-indigo-200" : "text-gray-400"
                              }`}
                          >
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p
                          className={`${msg.user === socketRef.current?.id ? "text-white" : "text-gray-700"
                            }`}
                        >
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={lastMessageRef} />
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="max-w-3xl mx-auto flex gap-2">
                <input
                  className="flex-grow px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Message in ${joinedRoom}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={sendMessage}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  disabled={!message.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center items-center flex-grow text-gray-400">
            <MessageSquare size={48} className="mb-4" />
            <p className="text-lg">Select or create a room to start chatting</p>
            <p className="text-sm mt-2">
              {roomList.length > 0
                ? `${roomList.length} rooms available`
                : 'No rooms yet - create the first one!'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}