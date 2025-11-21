const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Initialize Socket.io with CORS allowed from anywhere (for prototype)
// In production, restrict origin to your frontend domain
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Map to keep track of connected peers: { peerId: socketId }
const connectedPeers = new Map();
// Reverse map: { socketId: peerId }
const socketToPeer = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 1. User registers with a Peer ID
  socket.on('register', (peerId) => {
    if (connectedPeers.has(peerId)) {
        // Optional: handle duplicate ID or disconnect previous
        console.log(`Peer ID ${peerId} re-registered or taken.`);
    }
    
    connectedPeers.set(peerId, socket.id);
    socketToPeer.set(socket.id, peerId);
    
    console.log(`Registered: ${peerId} => ${socket.id}`);
    socket.emit('registered', peerId);
  });

  // 2. User initiates a call
  socket.on('call-user', ({ userToCall, signalData, from }) => {
    const targetSocketId = connectedPeers.get(userToCall);
    
    if (targetSocketId) {
      console.log(`Call initiated from ${from} to ${userToCall}`);
      io.to(targetSocketId).emit('incoming-call', { 
        signal: signalData, 
        from 
      });
    } else {
      console.log(`User ${userToCall} not found for call from ${from}`);
      // Optional: Notify caller that user is offline
    }
  });

  // 3. User answers a call
  socket.on('answer-call', ({ to, signal }) => {
    const targetSocketId = connectedPeers.get(to);
    
    if (targetSocketId) {
      console.log(`Answer sent to ${to}`);
      io.to(targetSocketId).emit('call-accepted', signal);
    }
  });

  // 4. Exchange ICE candidates
  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocketId = connectedPeers.get(to);
    
    if (targetSocketId) {
      // console.log(`ICE candidate forwarded to ${to}`);
      io.to(targetSocketId).emit('ice-candidate', { candidate, from: socketToPeer.get(socket.id) });
    }
  });

  // 5. Cleanup on disconnect
  socket.on('disconnect', () => {
    const peerId = socketToPeer.get(socket.id);
    if (peerId) {
      connectedPeers.delete(peerId);
      socketToPeer.delete(socket.id);
      console.log(`Peer ${peerId} disconnected`);
      
      // Notify others? (Optional for 1-on-1)
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

