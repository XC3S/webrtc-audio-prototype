"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import VideoCall from "./components/VideoCall";
import { Clock, Phone, X } from "lucide-react";
import Image from "next/image";

const TOPICS = ["Clock 1", "Clock 2", "Clock 3"];

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "connected">("idle");
  const [peerId, setPeerId] = useState<string>("");

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io();
    
    socketInstance.on("connect", () => {
      console.log("Connected to socket server");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setStatus("waiting");
    // Logic continues once PeerID is ready in VideoCall
  };

  const handlePeerIdReady = (id: string) => {
    setPeerId(id);
    // If we have a topic and socket is ready, join the topic queue
    if (selectedTopic && socket) {
      socket.emit("join_topic", { topic: selectedTopic, peerId: id });
    }
  };

  const handleCallStatusChange = (callStatus: "idle" | "connecting" | "calling" | "connected") => {
    if (callStatus === "connected") {
      setStatus("connected");
    } else if (callStatus === "idle" && status === "connected") {
      // Call ended
      handleEndSupport();
    }
  };

  const handleEndSupport = () => {
    if (socket) {
      socket.emit("leave_topic");
    }
    setSelectedTopic(null);
    setStatus("idle");
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <header className="w-full p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
         <div className="flex items-center gap-3">
            <Image 
            src="/logo.png" 
            alt="Logo" 
            width={32} 
            height={32} 
            className="rounded-lg"
            />
            <h1 className="text-xl font-bold">Support Center</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-8 max-w-4xl mx-auto w-full">
        
        <div className="w-full mb-8">
          <h2 className="text-2xl font-semibold mb-6">Recent Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TOPICS.map((topic) => (
              <div key={topic} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Clock className="text-zinc-500" />
                </div>
                <h3 className="text-lg font-medium mb-2">{topic}</h3>
                <p className="text-sm text-zinc-500 mb-6">Get help regarding {topic.toLowerCase()}.</p>
                <button
                  onClick={() => handleTopicSelect(topic)}
                  className="w-full py-3 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Phone size={18} />
                  Contact Support
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Support Overlay */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 aspect-video">
            
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div>
                 <h3 className="text-white font-semibold text-lg">Support: {selectedTopic}</h3>
                 <p className="text-zinc-400 text-sm">
                   {status === "waiting" ? "Connecting to an agent..." : "Live Support Call"}
                 </p>
              </div>
              <button 
                onClick={handleEndSupport}
                className="pointer-events-auto p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Waiting Screen Content (Visible when not connected yet) */}
            {status === "waiting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
                    <p className="text-white text-lg font-medium">Waiting for next available agent...</p>
                    <p className="text-zinc-500 text-sm mt-2">You are in the queue.</p>
                </div>
            )}

            {/* The Video Call Component - Always mounted to be ready for incoming calls */}
            <div className={`w-full h-full ${status === 'waiting' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>
                <VideoCall 
                    mode="embedded"
                    onPeerId={handlePeerIdReady}
                    onStatusChange={handleCallStatusChange}
                    onEnd={handleEndSupport}
                />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
