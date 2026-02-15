# Video Conferencing Application

A real-time video conferencing web application built with Next.js, Socket.IO, and WebRTC for seamless peer-to-peer video communication.

## Features

- **Real-time Video Calls** - High-quality peer-to-peer video streaming using WebRTC
- **Multi-participant Support** - Join meetings with multiple participants
- **Screen Sharing** - Share your screen during meetings for presentations
- **In-meeting Chat** - Send text messages to other participants in real-time
- **Mute/Unmute Audio** - Control your microphone during calls
- **Turn Camera On/Off** - Toggle your video feed
- **Speaking Indicators** - Visual feedback showing who is currently speaking
- **Host Controls** - Meeting hosts have additional controls
- **Name Customization** - Set your display name for meetings
- **Responsive Design** - Works on desktop and mobile browsers

## Technology Stack

- **Frontend**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **Real-time Communication**: Socket.IO
- **Video/Audio**: WebRTC (getUserMedia RTCPeerConnection)
,- **Server**: Node.js with Express-style server

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd video_conferenc
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Running in Production

```bash
npm run build
npm start
```

## How to Use

### Creating a Meeting

1. Enter your name on the home page
2. Click "Create Meeting" to generate a unique meeting ID
3. Share the meeting link with participants

### Joining a Meeting

1. Enter your name on the home page
2. Enter the meeting ID or use a shared meeting link
3. Click "Join Meeting" to enter the meeting room

### Meeting Controls

| Control | Description |
|---------|-------------|
| 🎤 Microphone | Toggle mute/unmute your audio |
| 📷 Camera | Turn video on/off |
| 🖥️ Screen Share | Share your screen with participants |
| 💬 Chat | Open meeting chat |
| 🚪 Leave | Leave the meeting |

## Project Structure

```
video_conferenc/
├── server.js              # Socket.IO server and Next.js handler
├── src/
│   └── app/
│       ├── page.js        # Home page (create/join meeting)
│       ├── layout.js      # Root layout
│       ├── globals.css    # Global styles
│       └── meeting/
│           └── [id]/
│               └── page.js    # Meeting room page
├── public/                # Static assets
└── package.json          # Dependencies
```

## WebRTC Architecture

This application uses a **full mesh WebRTC topology** where:
- Each participant establishes direct peer-to-peer connections with every other participant
- No media server is required (reduces server costs)
- Works best with 2-4 participants

### ICE Servers

The application uses Google's public STUN servers:
- stun:stun.l.google.com:19302
- stun:stun1.l.google.com:19302
- stun:stun2.l.google.com:19302

For production, consider adding TURN servers for better connectivity behind firewalls.

## Browser Compatibility

| Browser | Version |
|---------|---------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 14+ |
| Edge | 80+ |

## Known Limitations

- **Network Requirements**: All participants need reasonable bandwidth for video calls
- **NAT/Firewall**: Some NAT/firewall configurations may prevent peer-to-peer connections
- **Max Participants**: Recommended for 2-4 participants for optimal performance

## Troubleshooting

### Can't access camera/microphone
- Check browser permissions for camera and microphone
- Ensure you're using HTTPS (or localhost for development)

### Can't see other participants' videos
- Check your internet connection
- Refresh the page and rejoin the meeting
- Ensure other participants have enabled their cameras

### Connection issues
- Try using a different browser
- Check if firewalls are blocking WebRTC connections

## License

MIT License

## Author

Built with Next.js and WebRTC technology.
