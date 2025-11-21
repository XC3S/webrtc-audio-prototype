"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Copy, Check, Video, VideoOff } from "lucide-react";
import Image from "next/image";
import { useWebRTC } from "../hooks/useWebRTC";

export default function VideoCall() {
  const [peerId, setPeerId] = useState<string>("");
  const [remotePeerIdInput, setRemotePeerIdInput] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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

  // Get local video stream
  useEffect(() => {
    const getStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to get local stream", err);
        alert("Please allow camera and microphone access to use this app.");
      }
    };
    getStream();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Auto-answer incoming calls
  useEffect(() => {
    if (incomingCall && localStream) {
      console.log("Auto-answering video call from", incomingCall.from);
      answerCall(localStream);
    }
  }, [incomingCall, localStream, answerCall]);

  // Handle remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error("Error playing remote video:", e));
    }
  }, [remoteStream]);

  const handleStartCall = () => {
    if (remotePeerIdInput && localStream) {
      callUser(remotePeerIdInput, localStream);
    }
  };

  const handleEndCall = () => {
    hookEndCall();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
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

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="w-full flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <Image 
            src="/logo.png" 
            alt="Logo" 
            width={40} 
            height={40} 
            className="rounded-lg"
            />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Video Call Prototype</h2>
        </div>
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

      {/* Video Area */}
      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden mb-6 border border-zinc-800 shadow-inner">
        {/* Remote Video (Main) */}
        <video 
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
        />
        
        {status !== "connected" && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <p className="text-zinc-500">Remote video will appear here</p>
             </div>
        )}

        {/* Local Video (PIP) */}
        <div className="absolute bottom-4 right-4 w-48 aspect-video bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden shadow-2xl">
             <video 
                ref={localVideoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                autoPlay
                playsInline
                muted
             />
             {isVideoOff && (
                 <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                     <VideoOff size={20} className="text-zinc-500" />
                 </div>
             )}
        </div>
      </div>

      {/* Call Controls */}
      <div className="w-full space-y-4">
        {status === "idle" ? (
          <div className="space-y-4 max-w-md mx-auto">
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
              Start Video Call
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-center">
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
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoOff 
                    ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" 
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
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
    </div>
  );
}
