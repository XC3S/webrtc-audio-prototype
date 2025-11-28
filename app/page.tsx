"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import VideoCall from "./components/VideoCall";
import { Clock, Phone, X } from "lucide-react";
import Image from "next/image";

const AUCTIONS = [
  {
    id: "clock-1",
    title: "Clock 1",
    image: "/trolley/trolley1.jpeg",
    number: "#1",
    status: "won",
  },
  {
    id: "clock-2",
    title: "Clock 2",
    image: "/trolley/trolley2.jpeg",
    number: "#2",
    status: "lost",
  },
  {
    id: "clock-3",
    title: "Clock 3",
    image: "/trolley/trolley3.jpeg",
    number: "#3",
    status: "won",
  },
  {
    id: "clock-4",
    title: "Clock 4",
    image: "/trolley/trolley4.jpeg",
    number: "#4",
    status: "lost",
  },
];

export default function Home() {
  const [selectedAuction, setSelectedAuction] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "connected">("idle");
  const [peerId, setPeerId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "won">("all");

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io();
    
    socketInstance.on("connect", () => {
      console.log("Connected to socket server");
    });

    socketInstance.on("call_incoming", ({ adminPeerId }: { adminPeerId: string }) => {
      console.log("Incoming call signal from admin:", adminPeerId);
      // We don't need to do much here if PeerJS auto-answers, 
      // BUT we might need to ensure the UI knows we are connecting 
      // if the PeerJS 'call' event hasn't fired yet or if we want to be verbose.
      // The actual video connection happens via PeerJS.
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const handleAuctionSelect = (auction: string) => {
    setSelectedAuction(auction);
    setStatus("waiting");
    // Logic continues once PeerID is ready in VideoCall
  };

  const handlePeerIdReady = (id: string) => {
    setPeerId(id);
    // If we have an auction and socket is ready, join the auction queue
    if (selectedAuction && socket) {
      socket.emit("join_auction", { auction: selectedAuction, peerId: id });
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
      socket.emit("leave_auction");
    }
    setSelectedAuction(null);
    setStatus("idle");
  };

  const filteredAuctions = AUCTIONS.filter(auction => {
    if (filter === 'all') return true;
    return auction.status === 'won';
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
      <header className="w-full p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
         <div className="flex items-center gap-3">
            <Image 
            src="https://www.veilingrheinmaas.com/typo3conf/ext/site_template/Resources/Public/Img/logo.png" 
            alt="Logo" 
            width={0} 
            height={0}
            sizes="100vw"
            className="w-auto h-8 rounded-lg"
            />
            <h1 className="text-xl font-bold">Support Center</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-8 max-w-4xl mx-auto w-full">
        
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">My Recent Auctions</h2>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as "all" | "won")}
                className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 pr-8 text-sm font-medium outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <option value="all">Show All</option>
                <option value="won">Winners Only</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredAuctions.map((auction) => (
              <div key={auction.id} className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ease-out overflow-hidden flex flex-row h-48">
                {/* Left: Image Section */}
                <div className="relative w-48 h-full shrink-0 overflow-hidden">
                  <Image
                    src={auction.image}
                    alt={auction.title}
                    fill
                    className="object-cover"
                  />
                  {/* Overlay Gradient for text readability on image if needed, or just clean image */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" />
                  
                  {/* Big Number Overlay on Image */}
                  <div className="absolute top-4 left-4">
                     <span className="text-4xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tighter">{auction.number}</span>
                  </div>
                </div>

                {/* Right: Content Section */}
                <div className="flex-1 p-5 flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{auction.title}</h3>
                        </div>
                        <p className="text-sm text-zinc-500 line-clamp-2">
                            Auction regarding {auction.title.toLowerCase()} items. Click below to get support.
                        </p>
                      </div>
                      
                      <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          auction.status === 'won' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {auction.status}
                      </span>
                   </div>

                   <div className="pt-4">
                      <button
                        onClick={() => handleAuctionSelect(auction.title)}
                        className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Phone size={16} />
                        Contact Support
                      </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Support Overlay */}
      {selectedAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 aspect-video">
            
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div>
                 <h3 className="text-white font-semibold text-lg">Support: {selectedAuction}</h3>
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
