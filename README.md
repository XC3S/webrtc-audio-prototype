# WebRTC SFU Prototype

A scalable video conferencing prototype using **Mediasoup** (SFU Architecture), **Next.js 15**, **Socket.io**, and a self-hosted **Coturn** server.

![Screenshot](public/window.svg)

## Architecture

This project implements a Selective Forwarding Unit (SFU) architecture:
1.  **Frontend (Next.js)**: Captures user media, fetches ICE credentials, and connects to the signaling server.
2.  **Signaling Server (Node.js)**: Orchestrates rooms and peers via Socket.io.
3.  **Media Server (Mediasoup)**:
    *   Runs inside the signaling server container.
    *   Receives one high-quality stream from each publisher.
    *   Forwards that stream to all other subscribers in the room (N-to-N broadcasting).
    *   Uses specific UDP/TCP ports (`10000-10100`) for media traffic.
4.  **TURN Server (Coturn)**:
    *   Provides relay capabilities for clients behind restrictive firewalls.
    *   Self-hosted via Docker.
    *   Default ports: `3478` (STUN/TURN), `49152-65535` (Relay).

## Prerequisites

*   Docker & Docker Compose
*   Node.js 18+ (for local development without Docker)

## Getting Started

### 1. Start with Docker (Recommended)

This will start the Frontend (3000), SFU Server (3001), and TURN Server (3478).

```bash
docker-compose up --build
```

*   **Frontend**: [http://localhost:3000](http://localhost:3000)
*   **Signaling Server**: http://localhost:3001
*   **TURN Server**: localhost:3478

### 2. Usage

1.  Open [http://localhost:3000](http://localhost:3000) in multiple browser tabs or windows.
2.  Enter a **Room Name** (e.g., `demo`).
3.  Click **Join Room**.
4.  You should see all participants in a grid layout.

### Configuration

*   **Media Ports**: The SFU uses ports `10000-10100` (UDP/TCP).
*   **TURN Ports**: Coturn uses `3478` and range `49152-65535`.
*   **Announced IP**: 
    *   **SFU**: By default `127.0.0.1`. Update `MEDIASOUP_ANNOUNCED_IP` in `docker-compose.yml` if deploying or testing on LAN.
    *   **TURN**: Update command flag `--external-ip` in `docker-compose.yml` if deploying.

## Project Structure

*   **`/app`**: Next.js Frontend.
    *   `components/VideoCall.tsx`: Main UI with video grid.
    *   `hooks/useWebRTC.ts`: Custom hook managing Mediasoup client logic.
    *   `api/turn-credentials/route.ts`: Serves local TURN credentials to the client.
*   **`/signaling-server`**: Node.js backend.
    *   `server.js`: Socket.io handlers and Mediasoup orchestration.
    *   `config.js`: Mediasoup codec and transport settings.

## Troubleshooting

*   **Black Screen / No Video**:
    *   Ensure ports `10000-10100` are not blocked by a firewall.
    *   If running on a remote server, ensure `MEDIASOUP_ANNOUNCED_IP` and Coturn's `--external-ip` match the public IP.
*   **Build Errors**:
    *   If `mediasoup` fails to build, ensure you are using the provided `Dockerfile` which includes `python3` and `build-essential`.
