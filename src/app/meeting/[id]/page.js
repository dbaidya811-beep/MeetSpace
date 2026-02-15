"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function MeetingRoom() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const meetingId = params.id;
  // Get name from URL parameter (not used anymore, name stored in localStorage)
  
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [speakingUser, setSpeakingUser] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState({}); // Track who is speaking
  
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const screenStreamRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const isHostRef = useRef(false);
  const userIdRef = useRef("");
  const meetingInfoRef = useRef(null);

  // Play video when stream is ready
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(console.error);
    }
  }, [localStream]);

  // Ensure audio is playing for remote participants and detect speaking
  useEffect(() => {
    participants.forEach(p => {
      if (p.stream && !p.audioAnalyzed) {
        // Create audio context to detect speaking
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(p.stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          const detectAudio = () => {
            if (!p.stream) return;
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            setSpeakingUsers(prev => ({
              ...prev,
              [p.socketId]: average > 30
            }));
            
            if (p.stream) {
              requestAnimationFrame(detectAudio);
            }
          };
          detectAudio();
          
          // Mark as analyzed
          p.audioAnalyzed = true;
        } catch (e) {
          console.log("Audio analysis error:", e);
        }
      }
    });
  }, [participants]);

  // Get meeting info from localStorage
  const getMeetingInfo = () => {
    if (typeof window !== "undefined") {
      const info = localStorage.getItem("meetingInfo");
      // Check if the stored meeting ID matches current meeting
      if (info) {
        const parsed = JSON.parse(info);
        // If meeting ID doesn't match, clear old data
        if (parsed.meetingId !== meetingId) {
          localStorage.removeItem("meetingInfo");
          return null;
        }
        return parsed;
      }
    }
    return null;
  };

  // Create peer connection function
  const createPeerConnection = async (socketId, createOffer, currentSocket) => {
    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    };

    console.log("🔗 Creating peer connection with:", socketId);

    const pc = new RTCPeerConnection(config);
    peerConnections.current[socketId] = pc;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentSocket) {
        currentSocket.emit("ice-candidate", {
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log("📡 Connection state:", pc.connectionState);
    };

    pc.ontrack = (event) => {
      console.log("📹 Received remote track from:", socketId, "stream:", event.streams[0]);
      setParticipants((prev) => {
        const existing = prev.find((p) => p.socketId === socketId);
        if (existing) {
          // Update existing participant with stream
          return prev.map((p) =>
            p.socketId === socketId
              ? { ...p, stream: event.streams[0] }
              : p
          );
        }
        // Add new participant with stream if we have a valid socketId
        if (socketId) {
          const userId = `User-${socketId.substr(0, 6)}`;
          console.log("📹 Adding new participant from track:", socketId, "with userId:", userId);
          return [...prev, { socketId, stream: event.streams[0], userId }];
        }
        return prev;
      });
    };

    // Create offer if needed
    if (createOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      currentSocket.emit("offer", { to: socketId, offer: pc.localDescription });
    }

    return pc;
  };

  // Initialize socket connection
  useEffect(() => {
    meetingInfoRef.current = getMeetingInfo();
    isHostRef.current = meetingInfoRef.current?.isHost || false;
    
    // Check if user has a name, if not show name modal
    if (!meetingInfoRef.current?.userId || meetingInfoRef.current?.userId.startsWith('User-')) {
      setShowNameModal(true);
      return;
    }
    
    // Get user from localStorage or generate random
    const finalUserId = meetingInfoRef.current?.userId || `User-${Math.random().toString(36).substring(7)}`;
    userIdRef.current = finalUserId;
    setDisplayName(finalUserId);

    console.log("Initializing socket connection...");
    
    const newSocket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      setError("Could not connect to server");
    });

    newSocket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("error", (data) => {
      console.error("❌ Socket error:", data.message);
      setError(data.message);
    });

    newSocket.on("meeting-created", ({ meetingId: id }) => {
      console.log("✅ Meeting created:", id);
    });

    newSocket.on("user-joined", async ({ userId, socketId }) => {
      console.log("👤 User joined:", userId, socketId);
      // Check if user already exists to avoid duplicates
      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === socketId);
        if (exists) {
          return prev;
        }
        // Existing user learns about new joiner - create offer
        setTimeout(() => {
          createPeerConnection(socketId, true, newSocket)
            .then(pc => console.log("✅ Created peer connection to", socketId))
            .catch(err => console.error("❌ Error creating peer connection:", err));
        }, 500);
        return [...prev, { socketId, userId, stream: null }];
      });
    });

    newSocket.on("user-left", ({ socketId }) => {
      console.log("👋 User left:", socketId);
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    newSocket.on("participants-list", (list) => {
      console.log("📋 Participants list:", list);
      // The list contains { id: socket.id, userId } - map id to socketId for consistency
      const normalizedList = list.map(p => ({ socketId: p.id, userId: p.userId }));
      // Filter out self and get unique participants
      const otherParticipants = normalizedList.filter((p) => p.socketId !== newSocket.id);
      
      setParticipants((prev) => {
        // Create a map of existing participants by socketId
        const existingMap = new Map(prev.map(p => [p.socketId, p]));
        
        // Only add participants that don't already exist
        const newParticipants = otherParticipants.filter(p => !existingMap.has(p.socketId));
        
        if (newParticipants.length === 0) {
          // Update existing participants with their real names
          return prev.map(p => {
            const updated = otherParticipants.find(op => op.socketId === p.socketId);
            return updated ? { ...p, userId: updated.userId } : p;
          });
        }
        
        // Create peer connections for new participants
        // All participants should create offers to new participants for full mesh connectivity
        const shouldCreateOffer = true;
        newParticipants.forEach((participant) => {
          // Add small delay to ensure socket is ready
          setTimeout(() => {
            createPeerConnection(participant.socketId, shouldCreateOffer, newSocket)
              .then(pc => console.log("✅ Created peer connection to", participant.socketId, "createOffer:", shouldCreateOffer))
              .catch(err => console.error("❌ Error connecting to participant:", err));
          }, 500);
        });
        
        return [...prev, ...newParticipants];
      });
    });

    newSocket.on("offer", async ({ from, offer }) => {
      console.log("📨 Received offer from:", from);
      try {
        // Check if peer connection already exists
        let pc = peerConnections.current[from];
        if (!pc) {
          pc = await createPeerConnection(from, false, newSocket);
        } else {
          console.log("♻️ Reusing existing peer connection for", from);
        }
        
        // Only set remote description if in valid state
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          newSocket.emit("answer", { to: from, answer: pc.localDescription });
        } else {
          console.log("⚠️ Skipping offer, current state:", pc.signalingState);
        }
      } catch (err) {
        console.error("❌ Error handling offer:", err);
      }
    });

    newSocket.on("answer", async ({ from, answer }) => {
      console.log("📨 Received answer from:", from);
      const pc = peerConnections.current[from];
      if (pc) {
        try {
          console.log("Current signaling state:", pc.signalingState);
          // Only set remote description if in valid state
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          } else {
            console.log("⚠️ Skipping answer, current state:", pc.signalingState);
          }
        } catch (err) {
          console.error("❌ Error handling answer:", err);
        }
      } else {
        console.log("⚠️ No peer connection found for", from);
      }
    });

    newSocket.on("ice-candidate", async ({ from, candidate }) => {
      console.log("📨 Received ICE candidate from:", from);
      const pc = peerConnections.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("❌ Error adding ICE candidate:", err);
        }
      }
    });

    // Chat: Request message history
    newSocket.on("message-history", (history) => {
      console.log("📋 Message history:", history);
      setMessages(history);
    });

    // Chat: New message received
    newSocket.on("new-message", (message) => {
      console.log("💬 New message:", message);
      setMessages((prev) => [...prev, message]);
    });

    // Chat: User typing indicator
    newSocket.on("user-typing", ({ userId, socketId }) => {
      console.log("✍️ User typing:", userId);
      setTypingUsers((prev) => {
        if (!prev.find((u) => u.socketId === socketId)) {
          return [...prev, { userId, socketId }];
        }
        return prev;
      });
      // Clear typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.socketId !== socketId));
      }, 3000);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      console.log("🧹 Cleaning up socket connection");
      newSocket.disconnect();
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
    };
  }, []);

  // Get user media and join/create meeting
  useEffect(() => {
    if (!socket || isInitialized) return;

    const initMeeting = async () => {
      try {
        console.log("📹 Getting user media...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        
        console.log("✅ Got local stream");
        setLocalStream(stream);
        localStreamRef.current = stream;
        
        // Set video element source
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          // Try to play the video
          const playPromise = localVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              console.log("Play prevented:", err.message);
              // Auto-play might be blocked, try again on user interaction
            });
          }
        }

        const userId = userIdRef.current;
        
        if (isHostRef.current) {
          console.log("🏠 Creating meeting:", meetingId);
          socket.emit("create-meeting", {
            meetingId,
            userId,
          });
          // Request message history after creating/joining
          setTimeout(() => {
            socket.emit("get-messages", { meetingId });
          }, 1000);
        } else {
          console.log("🔗 Joining meeting:", meetingId);
          socket.emit("join-meeting", {
            meetingId,
            userId,
          });
          // Request message history after joining
          setTimeout(() => {
            socket.emit("get-messages", { meetingId });
          }, 1000);
        }
        
        setIsInitialized(true);
        setIsLoading(false);
      } catch (err) {
        console.error("❌ Error getting media:", err);
        setError("Could not access camera/microphone: " + err.message);
      }
    };

    initMeeting();
  }, [socket, isInitialized, meetingId]);

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Share screen
  const shareScreen = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(cameraStream);
      localStreamRef.current = cameraStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStream;
      }
      Object.values(peerConnections.current).forEach((pc) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender && cameraStream.getVideoTracks()[0]) {
          videoSender.replaceTrack(cameraStream.getVideoTracks()[0]);
        }
      });
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setLocalStream(screenStream);
        localStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        Object.values(peerConnections.current).forEach((pc) => {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender && screenStream.getVideoTracks()[0]) {
            videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });
        screenStream.getVideoTracks()[0].onended = () => {
          shareScreen();
        };
        setIsScreenSharing(true);
      } catch (err) {
        console.error("❌ Error sharing screen:", err);
      }
    }
  };

  // Leave meeting
  const leaveMeeting = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    router.push("/");
  };

  // Copy meeting link (without name parameter)
  const copyLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    alert("Meeting link copied!");
  };

  // Toggle chat
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  // Send message
  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      socket.emit("send-message", {
        meetingId,
        message: newMessage.trim(),
      });
      setNewMessage("");
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (socket) {
      socket.emit("typing", { meetingId });
    }
  };

  // Submit name from modal
  const submitName = () => {
    if (tempName.trim()) {
      const userId = tempName.trim();
      userIdRef.current = userId;
      setDisplayName(userId);
      
      // Store in localStorage
      localStorage.setItem("meetingInfo", JSON.stringify({
        meetingId,
        userId,
        isHost: meetingInfoRef.current?.isHost || false
      }));
      
      setShowNameModal(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-200 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-800 text-center font-medium mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-2xl font-semibold transition-colors shadow-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Name input modal for users joining via invite link
  if (showNameModal) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-200 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Enter Your Name</h2>
          <p className="text-gray-600 text-center mb-6">Please enter your name to join the meeting</p>
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                submitName();
              }
            }}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-2xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors mb-4"
            autoFocus
          />
          <button
            onClick={submitName}
            disabled={!tempName.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-semibold transition-colors shadow-md"
          >
            Join Meeting
          </button>
        </div>
      </div>
    );
  }

  // Loading spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Joining Meeting...</h2>
        <p className="text-gray-600">Please wait while we connect you</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-3 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-gray-900 font-semibold text-sm md:text-lg">MeetSpace</span>
          <span className="text-gray-400 hidden sm:inline">•</span>
          <span className="text-gray-500 text-xs md:text-sm font-medium hidden sm:inline">{meetingId}</span>
          <span className={`ml-2 px-2 md:px-3 py-0.5 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm bg-gray-200 hover:bg-gray-300 px-2 md:px-4 py-1.5 md:py-2 rounded-full transition-colors"
          >
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span className="hidden md:inline">Copy Link</span>
          </button>
        </div>
      </header>

      {/* Main Content with Chat */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid */}
        <main className="flex-1 p-2 md:p-4 overflow-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
          {/* Local Video */}
          <div className={`relative bg-white rounded-2xl md:rounded-3xl overflow-hidden aspect-video shadow-lg border-2 ${speakingUser === 'local' ? 'border-green-500' : 'border-gray-200'} transition-colors duration-300`}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-white/90 backdrop-blur-sm px-2 md:px-4 py-1 md:py-1.5 rounded-full shadow-md">
              <span className="text-gray-800 text-xs md:text-sm font-medium">{displayName || 'You'} {isMuted && "🔇"}</span>
            </div>
            {isVideoOff && (
              <div className="absolute inset-0 bg-gray-300 flex flex-col items-center justify-center">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-400 rounded-full flex items-center justify-center shadow-inner mb-2">
                  <span className="text-3xl md:text-4xl text-white">{displayName?.charAt(0).toUpperCase() || '👤'}</span>
                </div>
                <span className="text-white text-xs md:text-sm font-medium">{displayName || 'You'}</span>
              </div>
            )}
          </div>

          {/* Remote Participants */}
          {/* Sort participants: speaking users first, filter out invalid */}
          {(() => {
            const validParticipants = participants.filter(p => p.socketId);
            const sortedParticipants = [...validParticipants].sort((a, b) => {
              const aSpeaking = speakingUsers[a.socketId] ? 1 : 0;
              const bSpeaking = speakingUsers[b.socketId] ? 1 : 0;
              return bSpeaking - aSpeaking;
            });
            return sortedParticipants.map((participant) => (
              <div 
                key={`participant-${participant.socketId}`} 
                className={`relative bg-white rounded-2xl md:rounded-3xl overflow-hidden aspect-video shadow-lg border-2 ${speakingUsers[participant.socketId] ? 'border-green-500 animate-pulse' : 'border-gray-200'}`}
              >
                <VideoPlayer stream={participant.stream} />
                <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-white/90 backdrop-blur-sm px-2 md:px-4 py-1 md:py-1.5 rounded-full shadow-md">
                  <span className="text-gray-800 text-xs md:text-sm font-medium">{participant.userId}</span>
                </div>
                {speakingUsers[participant.socketId] && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </main>
      </div>

      {/* Controls */}
      <footer className="bg-white/90 backdrop-blur-md border-t border-gray-200 px-2 md:px-6 py-2 md:py-4">
        <div className="flex items-center justify-center gap-2 md:gap-6">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            {isMuted ? (
              <svg className="w-5 h-5 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 md:w-7 md:h-7 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isVideoOff ? "bg-red-500 hover:bg-red-600" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            {isVideoOff ? (
              <svg className="w-5 h-5 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-5 h-5 md:w-7 md:h-7 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          <button
            onClick={shareScreen}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isScreenSharing ? "bg-green-500 hover:bg-green-600" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            <svg className={`w-5 h-5 md:w-7 md:h-7 ${isScreenSharing ? 'text-white' : 'text-gray-800'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={toggleChat}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg relative ${isChatOpen ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            <svg className={`w-5 h-5 md:w-7 md:h-7 ${isChatOpen ? 'text-white' : 'text-gray-800'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {messages.length > 9 ? '9+' : messages.length}
              </span>
            )}
          </button>

          <button
            onClick={leaveMeeting}
            className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg"
          >
            <svg className="w-5 h-5 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      </footer>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed md:absolute inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 z-50 md:z-10 w-full md:w-80 bg-white md:border-l border-gray-200 flex flex-col h-full">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-800">Chat</h3>
            <button
              onClick={toggleChat}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center text-sm">No messages yet. Start the conversation!</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.senderId === socketRef.current?.id ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-600">{msg.senderName}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.senderId === socketRef.current?.id
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 text-black rounded-bl-md'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            {typingUsers.length > 0 && (
              <div className="text-xs text-gray-500 italic">
                {typingUsers.map((u) => u.userId).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm text-black focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="w-10 h-10 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Video Player Component
function VideoPlayer({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play()
        .then(() => console.log("Remote video playing"))
        .catch(err => console.log("Remote play error:", err));
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
}
