# WebRTC Audio & Video Call Prototype

A modern, responsive WebRTC prototype built with Next.js 16, React 19, and PeerJS. This application demonstrates real-time audio and video communication between peers.

## Features

- **Video Calling**: Full audio/video communication with a picture-in-picture local view.
- **Audio Calling**: Voice-only mode with mute controls.
- **Real-time Connection**: Uses PeerJS for simplified WebRTC signaling.
- **TURN/STUN Support**: 
  - Automatic fallback to public STUN servers (Google).
  - Configurable TURN server support (optimized for [Metered.ca](https://www.metered.ca/)).
- **Modern UI**: Built with Tailwind CSS v4, featuring a clean, responsive design with dark mode support.
- **Device Control**: Toggle microphone and camera during calls.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **WebRTC**: [PeerJS](https://peerjs.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/webrtc-auto-prototype.git
   cd webrtc-auto-prototype
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure TURN Credentials:
   Create a `.env.local` file in the root directory to add TURN server credentials (useful for connections behind strict firewalls). This project is pre-configured for Metered.ca but can be adapted.

   ```env
   TURN_USERNAME=your_metered_username
   TURN_CREDENTIAL=your_metered_credential
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Open Two Clients**: Open the application in two separate browser windows or tabs (or use two different devices on the same network).
2. **Get Peer ID**: On Client A, look for the "Your Peer ID" section and click the copy button.
3. **Connect**: 
   - Paste Client A's Peer ID into the "Remote Peer ID" input field on Client B.
   - Click **Start Video Call**.
4. **Grant Permissions**: Allow the browser to access your microphone and camera when prompted.
5. **Controls**:
   - **Mute**: Toggle microphone on/off.
   - **Video**: Toggle camera on/off (Video mode only).
   - **End Call**: Disconnect the current session.

## Project Structure

- `app/page.tsx`: Main entry point rendering the call interface.
- `app/components/`:
  - `VideoCall.tsx`: Handles video stream logic, rendering, and call controls.
  - `AudioCall.tsx`: simplified audio-only implementation (optional use).
- `app/api/turn-credentials/`: API route to securely fetch ICE server configuration for PeerJS.

## License

This project is open-source and available under the [MIT License](LICENSE).

