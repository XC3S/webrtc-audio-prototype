"use client";

import { useEffect, useRef, useState } from "react";
import { Peer, MediaConnection } from "peerjs";
import { Phone, PhoneOff, Mic, MicOff, Copy, Check, Video, VideoOff } from "lucide-react";
import Image from "next/image";

interface VideoCallProps {
  mode?: "standalone" | "embedded";
  remotePeerId?: string;
  onPeerId?: (id: string) => void;
  onEnd?: () => void;
  onStatusChange?: (status: "idle" | "connecting" | "calling" | "connected") => void;
  autoStart?: boolean;
}

export default function VideoCall({ 
  mode = "standalone", 
  remotePeerId, 
  onPeerId, 
  onEnd,
  onStatusChange,
  autoStart = false 
}: VideoCallProps) {
  const [peerId, setPeerId] = useState<string>("");
  const [remotePeerIdInput, setRemotePeerIdInput] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "connecting" | "calling" | "connected">("idle");

  // Update status wrapper
  const updateStatus = (newStatus: "idle" | "connecting" | "calling" | "connected") => {
    setStatus(newStatus);
    if (onStatusChange) onStatusChange(newStatus);
  };

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const hasAutoStarted = useRef(false);

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
          if (onPeerId) onPeerId(id);
        });

        peer.on("call", (call) => {
          console.log("Incoming call from:", call.peer);
          updateStatus("connected");
          
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
              localStreamRef.current = stream;
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
              }
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

    // Get local video stream early
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Failed to get local stream", err);
        alert("Please allow camera and microphone access to use this app.");
      });

    return () => {
      peerRef.current?.destroy();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Handle auto-start
  useEffect(() => {
    if (autoStart && remotePeerId && peerId && localStreamRef.current && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startCall(remotePeerId);
    }
  }, [autoStart, remotePeerId, peerId, localStreamRef.current]);

  const handleCallStream = (call: MediaConnection) => {
    callRef.current = call;
    updateStatus("connected");

    call.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        // Attempt play, but catch interruptions gracefully
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                if (e.name === "AbortError") {
                    // The play request was interrupted by a new load request. 
                    // This often happens if stream is reset quickly. Safe to ignore.
                    console.log("Video play interrupted by new stream load (harmless)");
                } else {
                    console.error("Error playing remote video:", e);
                }
            });
        }
      }
    });

    call.on("close", () => {
      endCallInternal();
    });

    call.on("error", (err) => {
      console.error("Call error:", err);
      endCallInternal();
    });
  };

  const startCall = (targetId?: string) => {
    const idToCall = targetId || remotePeerIdInput;
    if (!peerRef.current || !idToCall || !localStreamRef.current) return;

    updateStatus("calling");
    const call = peerRef.current.call(idToCall, localStreamRef.current);
    handleCallStream(call);
  };

  const endCallInternal = () => {
    callRef.current?.close();
    callRef.current = null;
    updateStatus("idle");
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (onEnd) onEnd();
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

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
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

  const containerClass = mode === "embedded" 
    ? "flex flex-col items-center w-full h-full bg-black text-white" 
    : "flex flex-col items-center w-full max-w-4xl p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800";

  return (
    <div className={containerClass}>
      {mode === "standalone" && (
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
              <Image 
              src="https://www.veilingrheinmaas.com/typo3conf/ext/site_template/Resources/Public/Img/logo.png" 
              alt="Logo" 
              width={0} 
              height={0}
              sizes="100vw"
              className="w-auto h-8 rounded-lg"
              />
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Video Call Prototype</h2>
          </div>
        </div>
      )}

      {/* Peer ID Section - Only show in standalone mode */}
      {mode === "standalone" && (
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
      )}

      {/* Video Area */}
      <div className={`relative w-full ${mode === 'embedded' ? 'h-full' : 'aspect-video rounded-2xl border border-zinc-800 shadow-inner mb-6'} bg-black overflow-hidden`}>
        {/* Remote Video (Main) */}
        <video 
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
        />
        
        {!callRef.current && status !== "connected" && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <p className="text-zinc-500">{status === 'calling' ? 'Calling...' : 'Waiting for connection...'}</p>
             </div>
        )}

        {/* Local Video (PIP) */}
        <div className="absolute bottom-4 right-4 w-32 md:w-48 aspect-video bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden shadow-2xl z-10">
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
        
        {/* Embedded Controls Overlay */}
        {mode === "embedded" && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-20">
                 <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  isMuted 
                    ? "bg-red-600 text-white" 
                    : "bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-sm"
                }`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoOff 
                    ? "bg-red-600 text-white" 
                    : "bg-zinc-800/80 text-white hover:bg-zinc-700 backdrop-blur-sm"
                }`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
              
              <button
                onClick={endCallInternal}
                className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg"
              >
                <PhoneOff size={24} />
              </button>
            </div>
        )}
      </div>

      {/* Call Controls (Standalone) */}
      {mode === "standalone" && (
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
                onClick={() => startCall()}
                disabled={!remotePeerIdInput || !peerId}
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
                  onClick={endCallInternal}
                  className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <PhoneOff size={24} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
