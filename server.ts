import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

type User = {
  id: string; // socket id
  peerId?: string;
  auction: string;
  joinedAt: number;
};

const waitingUsers: User[] = [];

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on("connection", (socket: Socket) => {
    console.log("Client connected", socket.id);

    // --- User Events ---

    socket.on("join_auction", ({ auction, peerId }: { auction: string; peerId: string }) => {
      console.log(`User ${socket.id} joined auction ${auction} with PeerID ${peerId}`);

      // Remove existing entry for this socket ID if any (prevents duplicates)
      const existingIndex = waitingUsers.findIndex(u => u.id === socket.id);
      if (existingIndex !== -1) {
        waitingUsers.splice(existingIndex, 1);
      }
      
      // Add to waiting list
      const newUser: User = {
        id: socket.id,
        peerId,
        auction,
        joinedAt: Date.now(),
      };
      waitingUsers.push(newUser);
      
      // Join a room for this auction so we can target them easily if needed, 
      // though specific user targeting usually uses socket.id
      socket.join(`auction_${auction}`);

      // Notify admins of this auction
      io.to(`admin_${auction}`).emit("queue_update", waitingUsers.filter(u => u.auction === auction));
    });

    socket.on("leave_auction", () => {
      const index = waitingUsers.findIndex(u => u.id === socket.id);
      if (index !== -1) {
        const user = waitingUsers[index];
        waitingUsers.splice(index, 1);
        io.to(`admin_${user.auction}`).emit("queue_update", waitingUsers.filter(u => u.auction === user.auction));
      }
    });

    // --- Admin Events ---

    socket.on("admin_join_auction", (auction: string) => {
      console.log(`Admin ${socket.id} joined auction ${auction}`);
      socket.join(`admin_${auction}`);
      
      // Send current queue for this auction
      socket.emit("queue_update", waitingUsers.filter(u => u.auction === auction));
    });

    // Admin requests to call a user
    socket.on("call_request", ({ userId, adminPeerId }: { userId: string; adminPeerId: string }) => {
      console.log(`Admin ${socket.id} calling user ${userId}`);
      // Notify the specific user to prepare for a call or start the call
      io.to(userId).emit("call_incoming", { adminPeerId });
    });

    // --- Disconnect ---
    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
      const index = waitingUsers.findIndex(u => u.id === socket.id);
      if (index !== -1) {
        const user = waitingUsers[index];
        waitingUsers.splice(index, 1);
        // Notify admins
        io.to(`admin_${user.auction}`).emit("queue_update", waitingUsers.filter(u => u.auction === user.auction));
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

