import { NextResponse } from 'next/server';

export async function GET() {
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;

  if (!username || !credential) {
    return NextResponse.json({ 
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" } // Fallback to Google STUN
      ] 
    });
  }

  const iceServers = [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: username,
      credential: credential,
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: username,
      credential: credential,
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: username,
      credential: credential,
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: username,
      credential: credential,
    },
  ];

  return NextResponse.json({ iceServers });
}

