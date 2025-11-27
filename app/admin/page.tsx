"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import VideoCall from "../components/VideoCall";
import { Video, Clock } from "lucide-react";

type User = {
  id: string; // socket id
  peerId?: string;
  topic: string;
  joinedAt: number;
};

function AdminContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic") || "default";
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [queue, setQueue] = useState<User[]>([]);
  const [activeCallUser, setActiveCallUser] = useState<User | null>(null);
  const [adminPeerId, setAdminPeerId] = useState<string>("");

  useEffect(() => {
    const socketInstance = io();
    
    socketInstance.on("connect", () => {
      console.log("Connected to socket server");
      socketInstance.emit("admin_join", topic);
    });

    socketInstance.on("queue_update", (updatedQueue: User[]) => {
      setQueue(updatedQueue);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [topic]);

  const handleStartCall = (user: User) => {
    if (!adminPeerId) {
      alert("Admin Peer ID not ready yet");
      return;
    }
    setActiveCallUser(user);
    
    // Emit the signal to the server so it can tell the user we are calling
    if (socket) {
        socket.emit("call_request", { userId: user.id, adminPeerId });
    }
  };

  const handleCallEnd = () => {
    setActiveCallUser(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Support Dashboard</h1>
            <p className="text-zinc-500 mt-1">Topic: <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{topic}</span></p>
          </div>
          <div className="bg-white dark:bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-sm text-zinc-500">Status: </span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Online</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Queue List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock size={20} />
              Waiting Queue ({queue.length})
            </h2>
            
            <div className="space-y-3">
              {queue.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  No users waiting
                </div>
              ) : (
                queue.map((user) => (
                  <div key={user.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-md font-medium mb-1">
                          User
                        </span>
                        <p className="text-sm font-mono text-zinc-500 truncate w-32" title={user.peerId}>{user.peerId || "No ID"}</p>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {Math.floor((Date.now() - user.joinedAt) / 1000)}s wait
                      </span>
                    </div>
                    <button
                      onClick={() => handleStartCall(user)}
                      className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Video size={16} />
                      Start Call
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Call Area (Placeholder or Status) */}
          <div className="lg:col-span-2">
             <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-1 text-center h-full min-h-[400px] flex flex-col items-center justify-center text-zinc-400">
                {!activeCallUser && (
                    <>
                        <Video size={48} className="mb-4 opacity-20" />
                        <p>Select a user from the queue to start a call</p>
                        {/* We render a hidden VideoCall just to generate Admin ID and be ready */}
                        <div className="hidden">
                            <VideoCall 
                                mode="embedded" 
                                onPeerId={setAdminPeerId}
                            />
                        </div>
                    </>
                )}
             </div>
          </div>
        </div>

        {/* Full Screen Overlay for Active Call */}
        {activeCallUser && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-5xl h-full max-h-[80vh] relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
              <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <p className="text-white text-sm">Speaking with <span className="font-mono text-zinc-400">{activeCallUser.peerId?.substring(0, 8)}...</span></p>
              </div>
              <VideoCall 
                mode="embedded"
                remotePeerId={activeCallUser.peerId}
                autoStart={true}
                onEnd={handleCallEnd}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminContent />
        </Suspense>
    )
}

