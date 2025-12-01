# WebRTC Audio & Video Call Prototype

A modern, responsive WebRTC prototype built with Next.js 16, React 19, Socket.IO, and PeerJS. This application demonstrates a queue-based customer support video call system where users request help and admins answer calls from a dashboard.

## Features

- **Queue System**: Users join a support queue for specific topics (Auctions).
- **Admin Dashboard**: Real-time view of waiting users with duration tracking and auction switching.
- **One-Click Connection**: Admins can initiate calls to waiting users instantly.
- **Video Calling**: Full audio/video communication with a picture-in-picture local view.
- **Real-time Updates**: Powered by Socket.IO for queue management and signaling.
- **TURN/STUN Support**: 
  - Automatic fallback to public STUN servers (Google).
  - Configurable TURN server support (optimized for [Metered.ca](https://www.metered.ca/)).
- **Modern UI**: Built with Tailwind CSS v4, featuring a clean, responsive design with dark mode support.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Server**: Custom Node.js Server with [Socket.IO](https://socket.io/)
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
   git clone https://github.com/XC3S/webrtc-audio-prototype.git
   cd webrtc-audio-prototype
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
   *Note: This runs a custom server (`server.ts`) to handle both Next.js and Socket.IO.*

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

### User Flow (Client)
1. Open [http://localhost:3000](http://localhost:3000).
2. Select an auction (e.g., "Clock 1") and click **Contact Support**.
3. You will be placed in a queue with a "Waiting for next available agent..." message.
4. Wait for an admin to pick up your call.

### Admin Flow (Agent)
1. Open [http://localhost:3000/admin](http://localhost:3000/admin) in a separate window or tab.
2. You will be automatically redirected to the default auction ("Clock 1").
3. Use the dropdown menu to switch between auctions ("Clock 1" - "Clock 8").
4. You will see the "Support Dashboard" with a "Waiting Queue" for the selected auction.
5. When a user joins the queue, they will appear in the list.
6. Click **Start Call** next to a user to connect.
7. The video call will start immediately.

## Project Structure

- `server.ts`: Custom Node.js server integrating Next.js and Socket.IO for queue management.
- `app/page.tsx`: Main user interface for selecting auctions and joining the support queue.
- `app/admin/page.tsx`: Admin dashboard for monitoring queues and answering calls.
- `app/components/`:
  - `VideoCall.tsx`: Reusable component handling WebRTC logic, video rendering, and controls.
- `app/api/turn-credentials/`: API route to securely fetch ICE server configuration for PeerJS.

## License

This project is open-source and available under the [MIT License](LICENSE).
