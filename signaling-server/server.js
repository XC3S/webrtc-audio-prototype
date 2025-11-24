const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mediasoup = require('mediasoup');
const config = require('./config');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- Mediasoup Global Variables ---
let worker;
const rooms = new Map(); // { roomId: { router, peers: Map<socketId, { socket, transports, producers, consumers, peer_name }> } }

// --- Mediasoup Worker Initialization ---
async function startMediasoup() {
  worker = await mediasoup.createWorker({
    logLevel: config.worker.logLevel,
    logTags: config.worker.logTags,
    rtcMinPort: config.worker.rtcMinPort,
    rtcMaxPort: config.worker.rtcMaxPort,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  console.log('Mediasoup worker started (pid: %d)', worker.pid);
}

startMediasoup();

// --- Helper Functions ---

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    const router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
    room = { 
      router, 
      peers: new Map() 
    };
    rooms.set(roomId, room);
    console.log(`Created room: ${roomId}`);
  }
  return room;
}

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: config.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
  });

  // In production, you'd handle these events to clean up
  transport.on('dtlsstatechange', dtlsState => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('close', () => {
    console.log('Transport closed');
  });

  return transport;
}

// --- Socket.IO Handlers ---

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinRoom', async ({ roomId, peerId }, callback) => {
    try {
      const room = await getOrCreateRoom(roomId);
      
      // Store peer data
      room.peers.set(socket.id, {
        socket,
        roomId,
        peerId, // Logic peer ID (e.g. username/uuid)
        transports: new Map(),
        producers: new Map(),
        consumers: new Map()
      });

      console.log(`Peer ${peerId} (${socket.id}) joined room ${roomId}`);

      // Send back Router RTP Capabilities
      const rtpCapabilities = room.router.rtpCapabilities;
      callback({ rtpCapabilities });

      // Notify this peer about existing producers in the room (so they can consume them)
      const peer = room.peers.get(socket.id);
      for (const [otherSocketId, otherPeer] of room.peers) {
        if (otherSocketId === socket.id) continue;
        
        for (const [producerId, producer] of otherPeer.producers) {
           socket.emit('newProducer', {
             producerId: producer.id,
             producerSocketId: otherSocketId
           });
        }
      }

    } catch (error) {
      console.error("Error in joinRoom:", error);
      callback({ error: error.message });
    }
  });

  socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
    try {
      // Find peer's room
      let peerData = null;
      let room = null;
      for (const r of rooms.values()) {
        if (r.peers.has(socket.id)) {
           peerData = r.peers.get(socket.id);
           room = r;
           break;
        }
      }

      if (!peerData) return callback({ error: 'Peer not in room' });

      const transport = await createWebRtcTransport(room.router);
      
      // Store transport
      peerData.transports.set(transport.id, transport);

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });

    } catch (error) {
      console.error("Error creating transport:", error);
      callback({ error: error.message });
    }
  });

  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      // Find peer
      let peerData = null;
      for (const r of rooms.values()) {
        if (r.peers.has(socket.id)) {
           peerData = r.peers.get(socket.id);
           break;
        }
      }
      
      if (!peerData) return callback({ error: 'Peer not found' });
      const transport = peerData.transports.get(transportId);
      if (!transport) return callback({ error: 'Transport not found' });

      await transport.connect({ dtlsParameters });
      callback({ success: true });

    } catch (error) {
      console.error("Error connecting transport:", error);
      callback({ error: error.message });
    }
  });

  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
     try {
       let peerData = null;
       let room = null;
       for (const r of rooms.values()) {
         if (r.peers.has(socket.id)) {
            peerData = r.peers.get(socket.id);
            room = r;
            break;
         }
       }

       if (!peerData) return callback({ error: 'Peer not found' });
       const transport = peerData.transports.get(transportId);
       if (!transport) return callback({ error: 'Transport not found' });

       const producer = await transport.produce({ kind, rtpParameters });
       peerData.producers.set(producer.id, producer);

       console.log(`Peer ${peerData.peerId} produced ${kind} (id: ${producer.id})`);

       // Notify others in the room
       for (const [otherSocketId, otherPeer] of room.peers) {
         if (otherSocketId === socket.id) continue;
         otherPeer.socket.emit('newProducer', {
           producerId: producer.id,
           producerSocketId: socket.id 
         });
       }

       producer.on('transportclose', () => {
         console.log('Producer transport closed');
         producer.close();
         peerData.producers.delete(producer.id);
       });

       callback({ id: producer.id });

     } catch (error) {
       console.error("Error producing:", error);
       callback({ error: error.message });
     }
  });

  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    try {
      let peerData = null;
      let room = null;
      for (const r of rooms.values()) {
        if (r.peers.has(socket.id)) {
           peerData = r.peers.get(socket.id);
           room = r;
           break;
        }
      }

      if (!peerData) return callback({ error: 'Peer not found' });
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume' });
      }

      // Check if we have a transport for consuming. 
      // In this simple example, the client usually creates one receive transport and reuses it, 
      // or creates one per consumer. 
      // The client should pass the transportId they want to use, BUT typical examples often 
      // create a transport specifically for receiving if it doesn't exist, OR reuse.
      // Mediasoup client examples usually manage this. 
      // We'll assume the client has already created a transport for receiving and we need to find it.
      // Actually, `consume` needs a transport to be created ON THE SERVER to send data TO the client.
      // The client needs to tell us WHICH transport to use.
      // Wait, usually the flow is:
      // 1. Client creates a "Recv Transport" (server side creates it via createWebRtcTransport).
      // 2. Client calls "consume" with the ID of that transport.
      
      // So I need to update the socket event signature to accept transportId.
      // However, if I forgot it in the args above, I need to check.
      // socket.on('consume', async ({ producerId, rtpCapabilities, transportId }) ...
    } catch(e) {
      // ...
    }
  });
  
  // Let's fix the consume handler signature and logic
  socket.on('consume', async ({ producerId, transportId, rtpCapabilities }, callback) => {
     try {
       let peerData = null;
       let room = null;
       for (const r of rooms.values()) {
         if (r.peers.has(socket.id)) {
            peerData = r.peers.get(socket.id);
            room = r;
            break;
         }
       }

       if (!peerData) return callback({ error: 'Peer not found' });
       const transport = peerData.transports.get(transportId);
       if (!transport) return callback({ error: 'Transport not found' });

       if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: 'Cannot consume' });
       }

       const consumer = await transport.consume({
         producerId,
         rtpCapabilities,
         paused: true, // Recommended to start paused, then resume
       });

       peerData.consumers.set(consumer.id, consumer);

       consumer.on('transportclose', () => {
         consumer.close();
         peerData.consumers.delete(consumer.id);
       });

       consumer.on('producerclose', () => {
          socket.emit('consumerClosed', { consumerId: consumer.id });
          consumer.close();
          peerData.consumers.delete(consumer.id);
       });

       callback({
         params: {
           id: consumer.id,
           producerId,
           kind: consumer.kind,
           rtpParameters: consumer.rtpParameters,
         }
       });

     } catch (error) {
       console.error("Error consuming:", error);
       callback({ error: error.message });
     }
  });

  socket.on('resume', async ({ consumerId }, callback) => {
      let peerData = null;
       for (const r of rooms.values()) {
         if (r.peers.has(socket.id)) {
            peerData = r.peers.get(socket.id);
            break;
         }
       }
       if (peerData) {
           const consumer = peerData.consumers.get(consumerId);
           if (consumer) {
               await consumer.resume();
               if (callback) callback({ success: true });
           }
       }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Cleanup
    for (const [roomId, room] of rooms) {
      if (room.peers.has(socket.id)) {
        const peer = room.peers.get(socket.id);
        
        // Close everything
        peer.transports.forEach(t => t.close());
        peer.peers = null;
        room.peers.delete(socket.id);
        
        console.log(`Peer removed from room ${roomId}`);
        
        // Check if room is empty
        if (room.peers.size === 0) {
           room.router.close();
           rooms.delete(roomId);
           console.log(`Room ${roomId} closed`);
        } else {
           // Notify others (optional, if we want to remove their video)
           // But the consumer 'producerclose' event handles the track stopping usually.
           // We might want an explicit event for UI cleanup if track doesn't stop immediately.
           for (const [otherSocketId, otherPeer] of room.peers) {
             otherPeer.socket.emit('peerLeft', { peerId: peer.peerId });
           }
        }
      }
    }
  });

});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
