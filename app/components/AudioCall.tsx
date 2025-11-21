"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Copy, Check } from "lucide-react";
import Image from "next/image";
import { useWebRTC } from "../hooks/useWebRTC";

export default function AudioCall() {
  const [peerId, setPeerId] = useState<string>("");
  const [remotePeerIdInput, setRemotePeerIdInput] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Generate random Peer ID on mount
  useEffect(() => {
    setPeerId(Math.random().toString(36).substring(2, 9));
  }, []);

  const { 
    status, 
    incomingCall, 
    remoteStream, 
    callUser, 
    answerCall, 
    endCall: hookEndCall 
  } = useWebRTC(peerId);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Get local audio stream
  useEffect(() => {
    const getStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to get local stream", err);
        alert("Please allow microphone access to use this app.");
      }
    };
    getStream();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Auto-answer incoming calls (to match previous behavior)
  useEffect(() => {
    if (incomingCall && localStream) {
      // Add a small delay or just answer
      console.log("Auto-answering call from", incomingCall.from);
      answerCall(localStream);
    }
  }, [incomingCall, localStream, answerCall]);

  // Handle remote stream
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.error("Error playing remote audio:", e));
    }
  }, [remoteStream]);

  const handleStartCall = () => {
    if (remotePeerIdInput && localStream) {
      callUser(remotePeerIdInput, localStream);
    }
  };

  const handleEndCall = () => {
    hookEndCall();
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
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

  // Derived status for UI to match previous states
  // The hook has 'idle' | 'connecting' | 'calling' | 'connected'
  // We can use that directly.

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
              onClick={handleStartCall}
              disabled={!remotePeerIdInput || !peerId || !localStream}
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
                {status === "connected" ? "Connected" : (incomingCall ? "Incoming Call..." : "Calling...")}
              </h3>
              <p className="text-sm text-zinc-500 font-mono">
                {incomingCall ? incomingCall.from : (remotePeerIdInput || "Unknown Peer")}
              </p>
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
                onClick={handleEndCall}
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
