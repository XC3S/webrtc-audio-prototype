"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Copy, Check, Video, VideoOff, Users } from "lucide-react";
import Image from "next/image";
import { useWebRTC } from "../hooks/useWebRTC";

export default function VideoCall() {
  const [peerId, setPeerId] = useState<string>(""); // Used as 'username' essentially
  const [roomId, setRoomId] = useState<string>("room1"); // Default room
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Generate random Peer ID on mount
  useEffect(() => {
    setPeerId(Math.random().toString(36).substring(2, 9));
  }, []);

  const { 
    status, 
    remoteStreams,
    joinRoom,
    leaveRoom,
    produce
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

  const handleJoinRoom = async () => {
    if (roomId && localStream) {
      await joinRoom(roomId);
      
      // Publish tracks
      localStream.getTracks().forEach(track => {
        produce(track);
      });
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
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

  return (
    <div className="flex flex-col items-center w-full max-w-6xl p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="w-full flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <Image 
            src="/logo.png" 
            alt="Logo" 
            width={40} 
            height={40} 
            className="rounded-lg"
            />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">SFU Conference Prototype</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">
             <Users size={16} className="text-zinc-500" />
             <span className="text-sm font-medium">{remoteStreams.length + 1} in room</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Local Video */}
        <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
             <video 
                ref={localVideoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                autoPlay
                playsInline
                muted
             />
             <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
                 You ({peerId})
             </div>
             {isVideoOff && (
                 <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90">
                     <VideoOff size={32} className="text-zinc-500" />
                 </div>
             )}
        </div>

        {/* Remote Videos */}
        {remoteStreams.map((remote) => (
           <RemoteVideo key={remote.id} stream={remote.stream} id={remote.id} />
        ))}
      </div>

      {/* Controls */}
      <div className="w-full space-y-4">
        {status === "idle" ? (
          <div className="flex items-center gap-4 max-w-xl mx-auto p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <input
              type="text"
              placeholder="Enter Room Name"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!roomId || !localStream}
              className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Users size={20} />
              Join Room
            </button>
          </div>
        ) : (
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
                onClick={handleLeaveRoom}
                className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <PhoneOff size={24} />
              </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteVideo({ stream, id }: { stream: MediaStream; id: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
             <video 
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
             />
             <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
                 User {id.substring(0, 4)}...
             </div>
        </div>
    );
}
