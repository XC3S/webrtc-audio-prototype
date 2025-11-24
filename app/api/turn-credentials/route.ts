import { NextResponse } from 'next/server';

export async function GET() {
  // These come from docker-compose environment variables
  const username = process.env.TURN_USERNAME || 'myuser';
  const credential = process.env.TURN_CREDENTIAL || 'mypassword';

  const iceServers = [
    {
      urls: "stun:stun.l.google.com:19302", // Public STUN as backup
    },
    {
      urls: "turn:127.0.0.1:3478", // Your local TURN server
      username: username,
      credential: credential,
    },
  ];

  return NextResponse.json({ iceServers });
}
