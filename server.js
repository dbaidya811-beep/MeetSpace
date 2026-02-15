const { Server } = require('socket.io');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store meeting data
const meetings = new Map();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a meeting room
    socket.on('join-meeting', ({ meetingId, userId }) => {
      const meeting = meetings.get(meetingId);
      
      if (!meeting) {
        socket.emit('error', { message: 'Meeting not found' });
        return;
      }

      socket.join(meetingId);
      meeting.participants.push({ id: socket.id, userId });
      
      // Notify others in the meeting
      socket.to(meetingId).emit('user-joined', { userId, socketId: socket.id });
      
      // Send current participants to the new user
      socket.emit('participants-list', meeting.participants);
      
      console.log(`User ${userId} joined meeting ${meetingId}`);
    });

    // Create a new meeting
    socket.on('create-meeting', ({ meetingId, userId }) => {
      meetings.set(meetingId, {
        id: meetingId,
        hostId: socket.id,
        participants: [{ id: socket.id, userId }],
        createdAt: new Date()
      });
      socket.join(meetingId);
      console.log(`Meeting ${meetingId} created by ${userId}`);
      socket.emit('meeting-created', { meetingId });
    });

    // WebRTC signaling - offer
    socket.on('offer', ({ to, offer }) => {
      socket.to(to).emit('offer', { from: socket.id, offer });
    });

    // WebRTC signaling - answer
    socket.on('answer', ({ to, answer }) => {
      socket.to(to).emit('answer', { from: socket.id, answer });
    });

    // WebRTC signaling - ice candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Find and update meetings where this socket was present
      meetings.forEach((meeting, meetingId) => {
        const participantIndex = meeting.participants.findIndex(p => p.id === socket.id);
        if (participantIndex !== -1) {
          const participant = meeting.participants[participantIndex];
          meeting.participants.splice(participantIndex, 1);
          socket.to(meetingId).emit('user-left', { userId: participant.userId, socketId: socket.id });
          
          // Clean up empty meetings
          if (meeting.participants.length === 0) {
            meetings.delete(meetingId);
          }
        }
      });
    });

    // Chat: Send message to meeting
    socket.on('send-message', ({ meetingId, message }) => {
      const meeting = meetings.get(meetingId);
      if (meeting) {
        const sender = meeting.participants.find(p => p.id === socket.id);
        const messageData = {
          id: Date.now().toString(),
          text: message,
          senderId: socket.id,
          senderName: sender ? sender.userId : 'Unknown',
          timestamp: new Date().toISOString(),
        };
        
        // Store message in meeting
        if (!meeting.messages) {
          meeting.messages = [];
        }
        meeting.messages.push(messageData);
        
        // Keep only last 100 messages
        if (meeting.messages.length > 100) {
          meeting.messages = meeting.messages.slice(-100);
        }
        
        // Broadcast message to all in meeting
        io.to(meetingId).emit('new-message', messageData);
        console.log(`Message in meeting ${meetingId}:`, message);
      }
    });

    // Chat: Get message history
    socket.on('get-messages', ({ meetingId }) => {
      const meeting = meetings.get(meetingId);
      if (meeting && meeting.messages) {
        socket.emit('message-history', meeting.messages);
      } else {
        socket.emit('message-history', []);
      }
    });

    // Chat: Typing indicator
    socket.on('typing', ({ meetingId }) => {
      const meeting = meetings.get(meetingId);
      if (meeting) {
        const sender = meeting.participants.find(p => p.id === socket.id);
        socket.to(meetingId).emit('user-typing', {
          userId: sender ? sender.userId : 'Unknown',
          socketId: socket.id
        });
      }
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
