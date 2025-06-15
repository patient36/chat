import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track rooms and their users
const rooms = new Map();

// Track all connected sockets and their active rooms
const socketRooms = new Map();

// Helper function to broadcast room list to all clients
const broadcastRoomList = () => {
  const roomList = Array.from(rooms.entries()).map(([name, users]) => ({
    name,
    userCount: users.size,
  }));
  
  io.emit('roomList', roomList);
};

// Helper function to update active users in a room
const updateActiveUsers = (roomName) => {
  const users = Array.from(rooms.get(roomName) || []);
  io.to(roomName).emit('activeUsers', users.map(socketId => ({
    id: socketId,
    isSelf: false, // Will be set on client side
  })));
};

// Helper function to send system message to a room
const sendSystemMessage = (roomName, message) => {
  io.to(roomName).emit('message', {
    user: 'System',
    message,
    timestamp: Date.now(),
  });
};

// Handle new connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id.substring(0, 8)}`);
  socketRooms.set(socket.id, new Set());

  // Send initial room list to the new connection
  broadcastRoomList();

  // Handle joining a room
  socket.on('joinRoom', (roomName) => {
    if (typeof roomName !== 'string' || !roomName.trim()) {
      return;
    }

    const normalizedRoomName = roomName.trim();
    const currentRooms = socketRooms.get(socket.id);

    // Don't allow joining the same room twice
    if (currentRooms.has(normalizedRoomName)) {
      return;
    }

    // Initialize room if it doesn't exist
    if (!rooms.has(normalizedRoomName)) {
      rooms.set(normalizedRoomName, new Set());
    }

    // Add socket to room
    rooms.get(normalizedRoomName).add(socket.id);
    currentRooms.add(normalizedRoomName);
    socket.join(normalizedRoomName);

    // Notify room
    sendSystemMessage(
      normalizedRoomName,
      `User ${socket.id.substring(0, 8)} joined the room`
    );

    // Update all clients
    updateActiveUsers(normalizedRoomName);
    broadcastRoomList();
  });

  // Handle leaving a room
  socket.on('leaveRoom', (roomName) => {
    const normalizedRoomName = roomName.trim();
    const currentRooms = socketRooms.get(socket.id);

    if (!currentRooms.has(normalizedRoomName)) {
      return;
    }

    // Remove socket from room
    if (rooms.has(normalizedRoomName)) {
      rooms.get(normalizedRoomName).delete(socket.id);
      
      // Clean up empty rooms
      if (rooms.get(normalizedRoomName).size === 0) {
        rooms.delete(normalizedRoomName);
      }
    }

    currentRooms.delete(normalizedRoomName);
    socket.leave(normalizedRoomName);

    // Notify room
    sendSystemMessage(
      normalizedRoomName,
      `User ${socket.id.substring(0, 8)} left the room`
    );

    // Update all clients
    updateActiveUsers(normalizedRoomName);
    broadcastRoomList();
  });

  // Handle switching rooms
  socket.on('switchRoom', ({ from, to }) => {
    const fromRoom = from.trim();
    const toRoom = to.trim();
    const currentRooms = socketRooms.get(socket.id);

    if (!currentRooms.has(fromRoom) || fromRoom === toRoom) {
      return;
    }

    // Leave current room
    if (rooms.has(fromRoom)) {
      rooms.get(fromRoom).delete(socket.id);
      if (rooms.get(fromRoom).size === 0) {
        rooms.delete(fromRoom);
      }
    }
    currentRooms.delete(fromRoom);
    socket.leave(fromRoom);

    // Join new room
    if (!rooms.has(toRoom)) {
      rooms.set(toRoom, new Set());
    }
    rooms.get(toRoom).add(socket.id);
    currentRooms.add(toRoom);
    socket.join(toRoom);

    // Notify both rooms
    sendSystemMessage(
      fromRoom,
      `User ${socket.id.substring(0, 8)} left the room`
    );
    sendSystemMessage(
      toRoom,
      `User ${socket.id.substring(0, 8)} joined the room`
    );

    // Update all clients
    updateActiveUsers(fromRoom);
    updateActiveUsers(toRoom);
    broadcastRoomList();
  });

  // Handle chat messages
  socket.on('chatMessage', ({ room, message }) => {
    if (typeof message !== 'string' || !message.trim()) {
      return;
    }

    const normalizedRoom = room.trim();
    const currentRooms = socketRooms.get(socket.id);

    // Only allow messages if in the room
    if (currentRooms.has(normalizedRoom)) {
      io.to(normalizedRoom).emit('message', {
        user: socket.id.substring(0, 8),
        message: message.trim(),
        timestamp: Date.now(),
      });
    }
  });

  // Handle disconnection
  socket.on('disconnecting', () => {
    const currentRooms = socketRooms.get(socket.id);

    // Leave all rooms
    currentRooms.forEach((roomName) => {
      if (rooms.has(roomName)) {
        rooms.get(roomName).delete(socket.id);
        if (rooms.get(roomName).size === 0) {
          rooms.delete(roomName);
        }
      }

      sendSystemMessage(
        roomName,
        `User ${socket.id.substring(0, 8)} disconnected`
      );
      
      updateActiveUsers(roomName);
    });

    socketRooms.delete(socket.id);
    broadcastRoomList();
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id.substring(0, 8)}`);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});