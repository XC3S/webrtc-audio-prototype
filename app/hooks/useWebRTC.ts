import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:3001';

export interface RemotePeer {
  id: string; // This will now be the Peer's ID (socketId), not the track ID
  stream: MediaStream;
}

export const useWebRTC = (myPeerId: string) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [remoteStreams, setRemoteStreams] = useState<RemotePeer[]>([]);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);

  useEffect(() => {
    fetch('/api/turn-credentials')
      .then((res) => res.json())
      .then((data) => setIceServers(data.iceServers))
      .catch((err) => console.error('Failed to fetch ICE servers:', err));
  }, []);
  
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map()); // kind -> producer
  const consumersRef = useRef<Map<string, Consumer>>(new Map()); // consumerId -> consumer
  
  // Queue for consumers that arrive before transport is ready
  const consumeQueue = useRef<{ producerId: string; producerSocketId: string }[]>([]);

  // Initialize Socket
  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER_URL);
    
    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setStatus('idle');
    });

    socketRef.current.on('newProducer', ({ producerId, producerSocketId }) => {
      console.log('New producer announced:', producerId, 'from', producerSocketId);
      consume(producerId, producerSocketId);
    });

    socketRef.current.on('consumerClosed', ({ consumerId }) => {
        console.log('Consumer closed:', consumerId);
        removeConsumer(consumerId);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const joinRoom = useCallback(async (roomId: string) => {
    if (!socketRef.current) return;
    setStatus('connecting');

    return new Promise<void>((resolve) => {
      // 1. Join Room & Get Router Capabilities
      socketRef.current!.emit('joinRoom', { roomId, peerId: myPeerId }, async (response: any) => {
        if (response.error) {
          console.error('Join room error:', response.error);
          setStatus('idle');
          return;
        }

        const { rtpCapabilities } = response;
        
        // 2. Load Mediasoup Device
        try {
          const device = new Device();
          await device.load({ routerRtpCapabilities: rtpCapabilities });
          deviceRef.current = device;

          // 3. Create Transports
          await createSendTransport();
          await createRecvTransport();

          // Process queued consumers
          while (consumeQueue.current.length > 0) {
            const { producerId, producerSocketId } = consumeQueue.current.shift()!;
            await consume(producerId, producerSocketId);
          }

          setStatus('connected');
          resolve();
          
        } catch (error) {
          console.error('Failed to load device or create transports:', error);
          setStatus('idle');
        }
      });
    });
  }, [myPeerId]);

  const createSendTransport = async () => {
     if (!socketRef.current || !deviceRef.current) return;

     return new Promise<void>((resolve) => {
        socketRef.current!.emit('createWebRtcTransport', { consumer: false }, async ({ params }: any) => {
          if (!params) return; 

          const transport = deviceRef.current!.createSendTransport({
            ...params,
            iceServers,
          });
          sendTransportRef.current = transport;

          transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              socketRef.current?.emit('connectTransport', { 
                transportId: transport.id, 
                dtlsParameters 
              }, () => callback());
            } catch (error: any) {
              errback(error);
            }
          });

          transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            try {
              socketRef.current?.emit('produce', { 
                transportId: transport.id, 
                kind, 
                rtpParameters 
              }, ({ id }: any) => callback({ id }));
            } catch (error: any) {
              errback(error);
            }
          });

          resolve();
        });
     });
  };

  const createRecvTransport = async () => {
    if (!socketRef.current || !deviceRef.current) return;

    return new Promise<void>((resolve) => {
        socketRef.current!.emit('createWebRtcTransport', { consumer: true }, async ({ params }: any) => {
          if (!params) return;

          const transport = deviceRef.current!.createRecvTransport({
            ...params,
            iceServers,
          });
          recvTransportRef.current = transport;

          transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
                socketRef.current?.emit('connectTransport', { 
                  transportId: transport.id, 
                  dtlsParameters 
                }, () => callback());
            } catch (error: any) {
                errback(error);
            }
          });

          resolve();
        });
    });
 };

  const produce = useCallback(async (track: MediaStreamTrack) => {
    if (!deviceRef.current || !sendTransportRef.current) {
      console.error('Device or SendTransport not ready');
      return;
    }

    try {
      const producer = await sendTransportRef.current.produce({ track });
      producersRef.current.set(track.kind, producer);
      
      producer.on('trackended', () => {
        console.log('Track ended');
        // Could close producer here
      });

      producer.on('transportclose', () => {
        console.log('Producer transport closed');
        producersRef.current.delete(track.kind);
      });

    } catch (error) {
      console.error('Produce error:', error);
    }
  }, []);

  // Modified consume to handle peer grouping and race conditions
  const consume = useCallback(async (producerId: string, producerSocketId: string) => {
    if (!deviceRef.current || !socketRef.current) return;

    // If transport isn't ready yet, queue it
    if (!recvTransportRef.current) {
       console.log('Queueing consumer...', producerId);
       consumeQueue.current.push({ producerId, producerSocketId });
       return;
    }

    const rtpCapabilities = deviceRef.current.rtpCapabilities;

    socketRef.current.emit('consume', { 
      producerId, 
      transportId: recvTransportRef.current.id,
      rtpCapabilities 
    }, async ({ params }: any) => {
      if (!params) {
          console.error('Consume failed, no params');
          return;
      }

      try {
         const consumer = await recvTransportRef.current!.consume({
           id: params.id,
           producerId: params.producerId,
           kind: params.kind,
           rtpParameters: params.rtpParameters,
         });

         consumersRef.current.set(consumer.id, consumer);

         // GROUPING LOGIC:
         // Find if we already have a stream for this peer
         setRemoteStreams(prev => {
            const existingPeerIndex = prev.findIndex(p => p.id === producerSocketId);
            
            if (existingPeerIndex !== -1) {
                // Add track to existing stream
                const newRemoteStreams = [...prev];
                const peer = newRemoteStreams[existingPeerIndex];
                peer.stream.addTrack(consumer.track);
                return newRemoteStreams;
            } else {
                // Create new stream for new peer
                const stream = new MediaStream();
                stream.addTrack(consumer.track);
                return [...prev, { id: producerSocketId, stream }];
            }
         });

         // Resume the consumer (server starts it paused)
         socketRef.current?.emit('resume', { consumerId: consumer.id }, (response: any) => {
             // Callback handled
         });

      } catch (error) {
         console.error('Consume error:', error);
      }
    });
  }, []);

  const removeConsumer = (consumerId: string) => {
    const consumer = consumersRef.current.get(consumerId);
    if (consumer) {
        consumer.close();
        consumersRef.current.delete(consumerId);
        
        // We need to remove the track from the stream
        // Since we don't easily know WHICH peer owns this consumer without a reverse map,
        // we can iterate streams (not efficient but fine for prototype)
        // OR we just rely on the tracks being stopped? No, we should clean up the stream.
        
        // Better: find the track in streams
        setRemoteStreams(prev => {
             return prev.map(peer => {
                 const track = peer.stream.getTracks().find(t => t.id === consumer.track.id);
                 if (track) {
                     peer.stream.removeTrack(track);
                     // If stream has no tracks, could remove peer?
                     // Or keep peer until 'peerLeft' event?
                     // For now, let's keep it simple. If 0 tracks, maybe remove?
                 }
                 return peer;
             }).filter(peer => peer.stream.getTracks().length > 0);
        });
    }
  };

  const leaveRoom = useCallback(() => {
    // Close all producers
    producersRef.current.forEach(p => p.close());
    producersRef.current.clear();

    // Close all consumers
    consumersRef.current.forEach(c => c.close());
    consumersRef.current.clear();
    setRemoteStreams([]);
    consumeQueue.current = [];

    // Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    
    setStatus('idle');
    socketRef.current?.disconnect(); 
    socketRef.current?.connect(); 
  }, []);

  return {
    status,
    remoteStreams,
    joinRoom,
    leaveRoom,
    produce
  };
};
