import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:3001';

interface IncomingCall {
  from: string;
  signal: any;
}

export const useWebRTC = (myPeerId: string) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'calling' | 'connected'>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  // Initialize Socket connection
  useEffect(() => {
    if (!myPeerId) return;

    socketRef.current = io(SIGNALING_SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
      socketRef.current?.emit('register', myPeerId);
    });

    socketRef.current.on('incoming-call', ({ from, signal }) => {
      console.log('Incoming call from:', from);
      setIncomingCall({ from, signal });
      setStatus('connecting');
    });

    socketRef.current.on('call-accepted', async (signal) => {
      console.log('Call accepted by remote');
      setStatus('connected');
      if (peerConnectionRef.current) {
        try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
            // Process any queued candidates
            while (pendingCandidates.current.length > 0) {
                const candidate = pendingCandidates.current.shift();
                if (candidate) {
                    await peerConnectionRef.current.addIceCandidate(candidate);
                }
            }
        } catch (e) {
            console.error("Error setting remote description:", e);
        }
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate }) => {
      if (peerConnectionRef.current) {
        try {
            if (peerConnectionRef.current.remoteDescription) {
                 await peerConnectionRef.current.addIceCandidate(candidate);
            } else {
                 // Queue candidate if remote description isn't set yet
                 pendingCandidates.current.push(candidate);
            }
        } catch (e) {
          console.error("Error adding received ICE candidate", e);
        }
      }
    });

    return () => {
      socketRef.current?.disconnect();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [myPeerId]);

  const createPeerConnection = async () => {
    // Fetch ICE servers
    let iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
    ];

    try {
      const response = await fetch("/api/turn-credentials");
      const data = await response.json();
      if (data.iceServers) {
        iceServers = data.iceServers;
      }
    } catch (error) {
      console.error("Failed to fetch TURN credentials", error);
    }

    const pc = new RTCPeerConnection({
      iceServers,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        // Determine target - simplistic logic for prototype
        // In a real app, we need to track who we are talking to explicitly in state
        // For now, we rely on the socket server or state if we had it.
        // Wait, we need to know WHO to send it to.
        // Let's store the current 'connected peer' in a ref or state.
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track');
      setRemoteStream(event.streams[0]);
    };
    
    // Clean up pending candidates queue on new PC
    pendingCandidates.current = [];

    return pc;
  };

  // We need a way to track the remote peer ID for sending ICE candidates
  const currentRemotePeerId = useRef<string | null>(null);

  const callUser = useCallback(async (userToCall: string, stream: MediaStream) => {
    setStatus('calling');
    currentRemotePeerId.current = userToCall;
    localStreamRef.current = stream;

    const pc = await createPeerConnection();
    peerConnectionRef.current = pc;

    // Add tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle ICE candidates specifically for this peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { 
          to: userToCall, 
          candidate: event.candidate 
        });
      }
    };

    // Create Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.emit('call-user', {
      userToCall,
      signalData: offer,
      from: myPeerId
    });
  }, [myPeerId]);

  const answerCall = useCallback(async (stream: MediaStream) => {
    if (!incomingCall) return;
    
    setStatus('connected');
    localStreamRef.current = stream;
    currentRemotePeerId.current = incomingCall.from;

    const pc = await createPeerConnection();
    peerConnectionRef.current = pc;

    // Add tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { 
          to: incomingCall.from, 
          candidate: event.candidate 
        });
      }
    };

    // Set Remote Description (Offer)
    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));

    // Create Answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current?.emit('answer-call', {
      signal: answer,
      to: incomingCall.from
    });
    
    setIncomingCall(null);
  }, [incomingCall, myPeerId]);

  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
        // We don't stop the local stream tracks here because they might be used for preview
        // But we clear the ref from the connection perspective
    }
    setRemoteStream(null);
    setStatus('idle');
    setIncomingCall(null);
    currentRemotePeerId.current = null;
    // Notify server/remote? In a full app yes, here maybe just close.
  }, []);

  return {
    status,
    incomingCall,
    remoteStream,
    callUser,
    answerCall,
    endCall
  };
};

