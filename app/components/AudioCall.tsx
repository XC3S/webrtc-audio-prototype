"use client";

import { useEffect, useRef, useState } from "react";
import { Peer, MediaConnection } from "peerjs";
import { Phone, PhoneOff, Mic, MicOff, Copy, Check } from "lucide-react";
import Image from "next/image";

export default function AudioCall() {
  const [peerId, setPeerId] = useState<string>("");
  const [remotePeerIdInput, setRemotePeerIdInput] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "connecting" | "calling" | "connected">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callRef = useRef<MediaConnection | null>(null);

  useEffect(() => {
    // Initialize PeerJS
    const initPeer = async () => {
      try {
        // Fetch ICE servers from our API route
        const response = await fetch("/api/turn-credentials");
        const data = await response.json();
        const iceServers = data.iceServers || [
          { urls: "stun:stun.l.google.com:19302" },
        ];

        const peer = new Peer({
          config: {
            iceServers: iceServers,
          },
        });
        
        peer.on("open", (id) => {
          console.log("My peer ID is: " + id);
          setPeerId(id);
        });

        peer.on("call", (call) => {
          console.log("Incoming call from:", call.peer);
          // Auto-answer for prototype simplicity, or ask user
          // For this prototype, we'll answer automatically if we have a stream, 
          // or prompt if we don't (but we should have requested it on mount)
          
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              localStreamRef.current = stream;
              call.answer(stream); // Answer the call with an A/V stream.
              handleCallStream(call);
            })
            .catch((err) => {
              console.error("Failed to get local stream", err);
            });
        });
        
        peerRef.current = peer;
      } catch (error) {
        console.error("PeerJS initialization failed", error);
      }
    };

    initPeer();

    // Get local audio stream early
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
      })
      .catch((err) => {
        console.error("Failed to get local stream", err);
        alert("Please allow microphone access to use this app.");
      });

    return () => {
      peerRef.current?.destroy();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleCallStream = (call: MediaConnection) => {
    callRef.current = call;
    setStatus("connected");

    call.on("stream", (remoteStream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.error("Error playing remote audio:", e));
      }
    });

    call.on("close", () => {
      endCall();
    });

    call.on("error", (err) => {
      console.error("Call error:", err);
      endCall();
    });
  };

  const startCall = () => {
    if (!peerRef.current || !remotePeerIdInput || !localStreamRef.current) return;

    setStatus("calling");
    const call = peerRef.current.call(remotePeerIdInput, localStreamRef.current);
    handleCallStream(call);
  };

  const endCall = () => {
    callRef.current?.close();
    callRef.current = null;
    setStatus("idle");
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="w-full flex items-center justify-between mb-6">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={40} 
          height={40} 
          className="rounded-lg"
        />
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Audio Call Prototype</h2>
      </div>

      {/* Peer ID Section */}
      <div className="w-full mb-8 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 mb-2">Your Peer ID</p>
        <div className="flex items-center justify-between gap-2">
          <code className="flex-1 font-mono text-sm bg-white dark:bg-black p-2 rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden text-ellipsis">
            {peerId || "Generating ID..."}
          </code>
          <button
            onClick={copyToClipboard}
            disabled={!peerId}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            title="Copy ID"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Call Controls */}
      <div className="w-full space-y-4">
        {status === "idle" ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter Remote Peer ID"
              value={remotePeerIdInput}
              onChange={(e) => setRemotePeerIdInput(e.target.value)}
              className="w-full p-3 rounded-xl bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
            />
            <button
              onClick={startCall}
              disabled={!remotePeerIdInput || !peerId}
              className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Phone size={20} />
              Call Peer
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse">
              <Phone size={32} className="text-zinc-400" />
              {status === "connected" && (
                 <span className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900"></span>
              )}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {status === "connected" ? "Connected" : "Calling..."}
              </h3>
              <p className="text-sm text-zinc-500 font-mono">{remotePeerIdInput || "Unknown Peer"}</p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  isMuted 
                    ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" 
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audio Element (Hidden) */}
      <audio ref={remoteAudioRef} className="hidden" />
    </div>
  );
}

