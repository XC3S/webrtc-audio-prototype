import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:3001';

export interface RemotePeer {
  id: string; // socketId/producerId combo usually, but here we simplify
  stream: MediaStream;
}

export const useWebRTC = (myPeerId: string) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [remoteStreams, setRemoteStreams] = useState<RemotePeer[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map()); // kind -> producer
  const consumersRef = useRef<Map<string, Consumer>>(new Map()); // consumerId -> consumer

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

    socketRef.current.on('newProducer', ({ producerId }) => {
      console.log('New producer announced:', producerId);
      consume(producerId);
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

    // 1. Join Room & Get Router Capabilities
    socketRef.current.emit('joinRoom', { roomId, peerId: myPeerId }, async (response: any) => {
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

        setStatus('connected');
        
      } catch (error) {
        console.error('Failed to load device or create transports:', error);
        setStatus('idle');
      }
    });
  }, [myPeerId]);

  const createSendTransport = async () => {
     if (!socketRef.current || !deviceRef.current) return;

     socketRef.current.emit('createWebRtcTransport', { consumer: false }, async ({ params }: any) => {
        if (!params) return; // Error handled in server callback ideally

        const transport = deviceRef.current!.createSendTransport(params);
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
     });
  };

  const createRecvTransport = async () => {
    if (!socketRef.current || !deviceRef.current) return;

    socketRef.current.emit('createWebRtcTransport', { consumer: true }, async ({ params }: any) => {
       if (!params) return;

       const transport = deviceRef.current!.createRecvTransport(params);
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

  const consume = useCallback(async (producerId: string) => {
    if (!deviceRef.current || !recvTransportRef.current || !socketRef.current) return;

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

         // Create a new stream for this consumer
         const stream = new MediaStream();
         stream.addTrack(consumer.track);
         
         setRemoteStreams(prev => [...prev, { id: consumer.id, stream }]);

         // Resume the consumer (server starts it paused)
         socketRef.current?.emit('resume', { consumerId: consumer.id });

      } catch (error) {
         console.error('Consume error:', error);
      }
    });
  }, []);

  const removeConsumer = (consumerId: string) => {
    consumersRef.current.get(consumerId)?.close();
    consumersRef.current.delete(consumerId);
    setRemoteStreams(prev => prev.filter(p => p.id !== consumerId));
  };

  const leaveRoom = useCallback(() => {
    // Close all producers
    producersRef.current.forEach(p => p.close());
    producersRef.current.clear();

    // Close all consumers
    consumersRef.current.forEach(c => c.close());
    consumersRef.current.clear();
    setRemoteStreams([]);

    // Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    
    setStatus('idle');
    // Could emit 'leaveRoom' to server if we wanted explicit cleanup
    socketRef.current?.disconnect(); 
    socketRef.current?.connect(); // Reconnect for next session
  }, []);

  return {
    status,
    remoteStreams,
    joinRoom,
    leaveRoom,
    produce
  };
};
